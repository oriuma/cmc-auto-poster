// Проверка каждую минуту
chrome.alarms.create('checkScheduler', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkScheduler') {
    checkAndPost();
  }
});

function checkAndPost() {
  chrome.storage.local.get({ posts: [] }, (result) => {
    const now = Date.now();
    const pendingPost = result.posts.find(p => p.time <= now && p.status === 'pending');

    if (pendingPost) {
      console.log('Начинаю публикацию поста:', pendingPost.id);
      performPost(pendingPost);
    }
  });
}

function performPost(post) {
  // 1. Открываем вкладку Community
  const targetUrl = 'https://coinmarketcap.com/community/';

  chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
    // Ждем загрузки страницы (10 сек)
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectedPoster,
        args: [post]
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("Ошибка скрипта:", chrome.runtime.lastError);
        } else {
          removePost(post.id);
          // Можно закрыть вкладку через некоторое время
          // setTimeout(() => chrome.tabs.remove(tab.id), 10000); 
        }
      });
    }, 10000); 
  });
}

function removePost(id) {
  chrome.storage.local.get({ posts: [] }, (result) => {
    const posts = result.posts.filter(p => p.id !== id);
    chrome.storage.local.set({ posts: posts });
  });
}

// === ЭТОТ КОД ВЫПОЛНЯЕТСЯ НА СТРАНИЦЕ CMC ===
async function injectedPoster(postData) {
  console.log("Авто-постер запущен...", postData);

  const waitFor = (selector, timeout = 10000) => {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) return resolve(document.querySelector(selector));
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 1. Ищем поле ввода
  // Пытаемся найти по aria-label, placeholder или contenteditable
  let editor = document.querySelector('div[contenteditable="true"]');
  if (!editor) {
      // Запасной вариант: клик по кнопке "Start a discussion" или похожее, если редактор скрыт
      // Но обычно на странице /community/ редактор сразу виден сверху
      const possibleInputs = Array.from(document.querySelectorAll('div, textarea'));
      editor = possibleInputs.find(el => el.getAttribute('placeholder')?.includes("mind") || el.innerText.includes("mind"));
  }

  if (!editor) {
    console.error("Не найдено поле ввода! Проверьте селекторы.");
    return;
  }

  editor.focus();
  editor.click();
  await sleep(1000);

  // 2. Вставка текста
  document.execCommand('insertText', false, postData.text);
  await sleep(1000);

  // 3. Загрузка изображения
  if (postData.image) {
    // Ищем input[type=file]
    // На CMC кнопка картинки обычно создает input, но он может быть скрыт
    // Попробуем найти любой file input в области редактора
    const fileInputs = document.querySelectorAll('input[type="file"]');
    // Берем последний, так как он часто добавляется динамически при открытии редактора
    const fileInput = fileInputs[fileInputs.length - 1]; 
    
    if (fileInput) {
      try {
          // Конвертируем Base64 обратно в File
          const res = await fetch(postData.image);
          const blob = await res.blob();
          const file = new File([blob], "image.png", { type: "image/png" });

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;

          const event = new Event('change', { bubbles: true });
          fileInput.dispatchEvent(event);
          
          await sleep(5000); // Ждем загрузки превью
      } catch (e) {
          console.error("Ошибка при загрузке картинки", e);
      }
    } else {
      console.warn("Input для файла не найден");
    }
  }

  // 4. Нажатие кнопки Post
  // Ищем кнопку Post, которая активна (не disabled)
  const buttons = Array.from(document.querySelectorAll('button'));
  // Фильтруем по тексту и доступности
  const postBtn = buttons.find(b => (b.innerText.trim() === 'Post' || b.innerText.trim() === 'Reply') && !b.disabled);

  if (postBtn) {
      postBtn.click();
      console.log("Кнопка Post нажата!");
  } else {
      console.error("Кнопка Post не найдена или неактивна");
  }
}
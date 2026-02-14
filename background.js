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
    // Ищем посты, время которых наступило (или прошло) и статус 'pending'
    const pendingPost = result.posts.find(p => p.time <= now && p.status === 'pending');

    if (pendingPost) {
      console.log('Начинаю публикацию поста:', pendingPost.id);
      performPost(pendingPost);
    }
  });
}

function performPost(post) {
  // 1. Открываем профиль пользователя (как ты просил)
  const targetUrl = 'https://coinmarketcap.com/community/profile/cointhinker/';

  chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
    // Ждем 15 секунд полной загрузки React и прогрузки элементов
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectedPoster,
        args: [post]
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("Ошибка скрипта:", chrome.runtime.lastError);
        } else {
          // Если все ок, удаляем пост из очереди
          // (В реальной версии можно добавить проверку return value из injectedPoster)
          removePost(post.id);
        }
      });
    }, 15000); 
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
  console.log("🚀 Авто-постер CMC запущен", postData);
  
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // --- ЭТАП 1: СКРОЛЛ И ПОИСК СИНЕЙ КНОПКИ ---
  console.log("🔍 Ищем синюю кнопку...");
  
  let postButton = null;
  
  // Пытаемся найти кнопку в течение 30 секунд, периодически подскролливая
  for (let i = 0; i < 15; i++) {
    window.scrollBy(0, 300); // Скроллим вниз
    await sleep(1500);

    // Ищем кнопку по визуальным признакам:
    // 1. Тег button или div
    // 2. Синий фон (rgb(56, 97, 251))
    // 3. Обычно это плавающая кнопка (position: fixed) или кнопка с иконкой карандаша/плюса
    
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    postButton = buttons.find(b => {
      const style = window.getComputedStyle(b);
      const isBlue = style.backgroundColor === 'rgb(56, 97, 251)' || style.backgroundColor === '#3861fb';
      // Проверяем, что это не кнопка "Follow" (она тоже синяя)
      const isNotFollow = !b.innerText.includes("Follow"); 
      // Часто внутри есть SVG (карандаш или плюс)
      const hasSvg = b.querySelector('svg');
      
      return isBlue && isNotFollow && (hasSvg || b.innerText.includes("Post") || b.innerText === "+");
    });

    if (postButton) {
      console.log("✅ Кнопка найдена!", postButton);
      break;
    }
  }

  if (!postButton) {
    console.error("❌ Не удалось найти синюю кнопку для поста. Проверьте верстку.");
    return;
  }

  // Кликаем по кнопке открытия модалки
  postButton.click();
  await sleep(3000); // Ждем открытия модального окна

  // --- ЭТАП 2: РАБОТА В МОДАЛЬНОМ ОКНЕ ---
  console.log("📝 Ищем поле ввода в модальном окне...");

  // В модальном окне поле ввода - это обычно div[contenteditable="true"]
  // Ищем активный или видимый редактор
  const editors = Array.from(document.querySelectorAll('div[contenteditable="true"], textarea'));
  // Берем последний найденный, так как модалка обычно в конце DOM
  let editor = editors[editors.length - 1];

  if (!editor) {
    console.error("❌ Поле ввода не найдено в модальном окне.");
    return;
  }

  console.log("✍️ Пишем текст...");
  editor.focus();
  editor.click();
  await sleep(500);
  
  // Эмуляция ввода текста
  document.execCommand('insertText', false, postData.text);
  await sleep(2000);

  // --- ЭТАП 3: ЗАГРУЗКА ФОТО ---
  if (postData.image) {
    console.log("🖼 Загружаем фото...");
    // Ищем input file внутри модального окна (или рядом с редактором)
    // Обычно он скрыт (display: none), но он есть в DOM
    const fileInputs = document.querySelectorAll('input[type="file"]');
    // Берем последний, он скорее всего относится к открытой модалке
    const fileInput = fileInputs[fileInputs.length - 1]; 

    if (fileInput) {
      try {
        const res = await fetch(postData.image);
        const blob = await res.blob();
        const file = new File([blob], "image.png", { type: "image/png" });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(5000); // Ждем превью
      } catch (e) {
        console.error("Ошибка загрузки фото:", e);
      }
    }
  }

  // --- ЭТАП 4: ПУБЛИКАЦИЯ ---
  console.log("🚀 Нажимаем Post...");
  
  // Ищем кнопку Post внутри модалки
  // Она должна быть синей и содержать текст "Post"
  const allButtons = Array.from(document.querySelectorAll('button'));
  const finalPostBtn = allButtons.find(b => {
    return b.innerText.trim() === 'Post' && !b.disabled && b !== postButton; // Исключаем кнопку открытия
  });

  if (finalPostBtn) {
    finalPostBtn.click();
    console.log("✅ Успешно нажата кнопка публикации!");
  } else {
    console.error("❌ Финальная кнопка Post не найдена или неактивна.");
  }
}
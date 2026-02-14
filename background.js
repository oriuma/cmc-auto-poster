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
  // 1. Открываем профиль пользователя
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
  console.log("🔍 Ищем кнопку поста...");
  
  let postButton = null;
  
  // Пытаемся найти кнопку в течение 30 секунд
  for (let i = 0; i < 15; i++) {
    // Скроллим вниз, чтобы подгрузить элементы (иногда кнопка появляется при скролле)
    window.scrollBy(0, 500); 
    await sleep(1500);

    // 1. Приоритетный поиск: по классу, который дал пользователь
    // Ищем точное совпадение классов или частичное
    const specificButton = document.querySelector('.iSUEMj.post.button');
    
    // 2. Поиск по иконке #new-feed (очень надежный признак)
    const iconButton = document.querySelector('use[href="#new-feed"]');
    
    // 3. Поиск по тексту "Post" (резервный вариант)
    const textButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const textButton = textButtons.find(b => b.innerText.trim() === 'Post' || b.innerText.trim() === '+');

    if (specificButton) {
        postButton = specificButton;
        console.log("✅ Кнопка найдена по классу!");
    } else if (iconButton) {
        // Если нашли иконку, нужно кликнуть по её родителю (кнопке)
        postButton = iconButton.closest('div[role="button"]') || iconButton.closest('button') || iconButton.closest('div.post.button') || iconButton.closest('div');
        console.log("✅ Кнопка найдена по иконке #new-feed!");
    } else if (textButton) {
        postButton = textButton;
        console.log("⚠️ Кнопка найдена по тексту (менее надежно).");
    }

    if (postButton) {
      // Скроллим к кнопке, чтобы она была видна и кликабельна
      postButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(1000); 
      break;
    }
  }

  if (!postButton) {
    console.error("❌ Не удалось найти кнопку поста. Проверьте верстку.");
    return;
  }

  // Кликаем по кнопке
  postButton.click();
  console.log("🖱 Клик по кнопке поста...");
  await sleep(3000); // Ждем открытия модального окна

  // --- ЭТАП 2: РАБОТА В МОДАЛЬНОМ ОКНЕ ---
  console.log("📝 Ищем поле ввода в модальном окне...");

  // В модальном окне поле ввода - это обычно div[contenteditable="true"]
  // Ищем редактор внутри модального окна (dialog или div с высоким z-index)
  // Но проще найти все редакторы и взять последний (так как модалка в конце DOM)
  const editors = Array.from(document.querySelectorAll('div[contenteditable="true"], textarea'));
  let editor = editors[editors.length - 1];

  if (!editor) {
    console.error("❌ Поле ввода не найдено.");
    return;
  }

  console.log("✍️ Пишем текст...");
  editor.focus();
  
  // Эмуляция ввода
  document.execCommand('insertText', false, postData.text);
  await sleep(2000);

  // --- ЭТАП 3: ЗАГРУЗКА ФОТО ---
  if (postData.image) {
    console.log("🖼 Загружаем фото...");
    // Ищем input file. Обычно он один или последний в списке
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const fileInput = fileInputs[fileInputs.length - 1]; 

    if (fileInput) {
      try {
        const res = await fetch(postData.image);
        const blob = await res.blob();
        
        // Создаем файл с уникальным именем
        const fileName = `image_${Date.now()}.png`;
        const file = new File([blob], fileName, { type: "image/png" });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        // Важно: событие change должно всплывать
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(5000); // Ждем превью
      } catch (e) {
        console.error("Ошибка загрузки фото:", e);
      }
    } else {
        console.warn("Input для файла не найден");
    }
  }

  // --- ЭТАП 4: ПУБЛИКАЦИЯ ---
  console.log("🚀 Нажимаем финальную кнопку Post...");
  
  // Ищем кнопку Post внутри модалки
  const allButtons = Array.from(document.querySelectorAll('button'));
  const finalPostBtn = allButtons.find(b => {
    const text = b.innerText.trim();
    return (text === 'Post' || text === 'Reply') && !b.disabled;
  });

  if (finalPostBtn) {
    finalPostBtn.click();
    console.log("✅ Успешно опубликовано!");
  } else {
    console.error("❌ Финальная кнопка Post не найдена или неактивна.");
  }
}
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
  const targetUrl = 'https://coinmarketcap.com/community/profile/cointhinker/';

  chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
    // Ждем достаточно времени для полной загрузки
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
  console.log("🚀 Авто-постер CMC запущен v3", postData);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // --- ЭТАП 1: ПОИСК КНОПКИ (Уже работает) ---
  console.log("🔍 Ищем кнопку поста...");
  let postButton = null;
  for (let i = 0; i < 15; i++) {
    window.scrollBy(0, 500); 
    await sleep(1500);

    const specificButton = document.querySelector('.iSUEMj.post.button');
    const iconButton = document.querySelector('use[href="#new-feed"]');
    
    if (specificButton) {
        postButton = specificButton;
    } else if (iconButton) {
        postButton = iconButton.closest('div[role="button"]') || iconButton.closest('button') || iconButton.closest('div.post.button');
    }

    if (postButton) {
      postButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(1000); 
      break;
    }
  }

  if (!postButton) return console.error("❌ Не найдена кнопка открытия поста");
  postButton.click();
  await sleep(4000); // Даем модалке время открыться

  // --- ЭТАП 2: ВВОД ТЕКСТА (ИСПРАВЛЕННАЯ ЛОГИКА) ---
  console.log("📝 Работа с редактором...");
  
  // Ищем все contenteditable. В модальном окне он обычно последний.
  const editors = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
  const editor = editors[editors.length - 1];

  if (editor) {
      console.log("✍️ Редактор найден. Активируем...");
      
      // 1. ЖЕСТКИЙ ФОКУС
      // Эмулируем клик пользователя, чтобы React "проснулся" и убрал placeholder
      editor.focus();
      editor.click();
      // Дополнительно кликаем по родительскому элементу, если placeholder перехватывает клики
      if (editor.parentElement) editor.parentElement.click();
      
      await sleep(1000);

      // 2. ЭМУЛЯЦИЯ НАЖАТИЯ КЛАВИШИ (Очистка)
      // Иногда нужно "нажать" клавишу, чтобы React понял, что ввод начался
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a', char: 'a', keyCode: 65 }));
      await sleep(100);

      // 3. ВВОД ТЕКСТА ЧЕРЕЗ EXECCOMMAND (Это имитирует настоящий ввод)
      // Это самый надежный способ для contenteditable
      document.execCommand('selectAll', false, null); // Выделить все (на всякий случай)
      document.execCommand('insertText', false, postData.text); 
      
      // 4. ПРОВЕРКА И ДОБИВАНИЕ
      // Если текст не вставился или placeholder остался
      await sleep(500);
      if (editor.innerText.trim() === "" || editor.innerText.length < 2) {
          console.warn("⚠️ execCommand не сработал, пробуем запасной вариант...");
          editor.innerText = postData.text;
          // Очень важно: событие input дает понять React'у, что данные изменились
          const inputEvent = new Event('input', { bubbles: true, cancelable: true });
          editor.dispatchEvent(inputEvent);
      }
      
      await sleep(1000);
  } else {
      console.error("❌ Редактор текста не найден!");
  }

  // --- ЭТАП 3: ОПЦИИ (Bullish) ---
  const bullishBtn = Array.from(document.querySelectorAll('div, button, span')).find(el => el.innerText.trim() === 'Bullish');
  if (bullishBtn) {
      bullishBtn.click();
      await sleep(500);
  }

  // --- ЭТАП 4: ФОТО (Уже работает) ---
  if (postData.image) {
    console.log("🖼 Загружаем фото...");
    
    // Ищем кнопку галереи (рядом с GIF)
    const gifIcon = Array.from(document.querySelectorAll('div, span, button')).find(el => el.innerText === 'GIF');
    let fileInput = document.querySelector('input[type="file"]');
    
    // Если input'а нет, кликаем иконку галереи
    if (!fileInput && gifIcon) {
        const imageIconBtn = gifIcon.previousElementSibling || gifIcon.parentElement.previousElementSibling;
        if (imageIconBtn) {
            imageIconBtn.click();
            await sleep(1000);
            fileInput = document.querySelector('input[type="file"]');
        }
    }
    
    if (!fileInput) { // Fallback
         const inputs = document.querySelectorAll('input[type="file"]');
         fileInput = inputs[inputs.length - 1];
    }

    if (fileInput) {
      try {
        const res = await fetch(postData.image);
        const blob = await res.blob();
        const file = new File([blob], "image.png", { type: "image/png" });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(5000); 
      } catch (e) { console.error(e); }
    }
  }

  // --- ЭТАП 5: ПУБЛИКАЦИЯ ---
  console.log("🚀 Публикуем...");
  const postBtns = Array.from(document.querySelectorAll('button'));
  const finalPostBtn = postBtns.find(b => b.innerText.trim() === 'Post' && !b.disabled);

  if (finalPostBtn) {
    finalPostBtn.click();
    console.log("✅ УСПЕХ!");
  } else {
    console.error("❌ Кнопка Post неактивна. Возможно, текст не распознан.");
  }
}
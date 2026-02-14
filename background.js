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
    // Даем 15 секунд на полную загрузку
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
  console.log("🚀 Авто-постер CMC запущен v4 (Human Typing)", postData);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // --- ЭТАП 1: ПОИСК КНОПКИ ---
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
  await sleep(4000); 

  // --- ЭТАП 2: ВВОД ТЕКСТА (ЭМУЛЯЦИЯ ПЕЧАТИ) ---
  console.log("📝 Ищем редактор...");
  
  // Ищем все contenteditable
  const editors = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
  const editor = editors[editors.length - 1];

  if (editor) {
      console.log("✍️ Редактор найден. Кликаем...");
      
      // 1. КЛИК И ФОКУС (ОБЯЗАТЕЛЬНО)
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);
      editor.focus();
      editor.click();
      
      // Кликаем по центру элемента (на всякий случай, если клик попал в край)
      const rect = editor.getBoundingClientRect();
      const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
      });
      editor.dispatchEvent(clickEvent);
      
      await sleep(1000); // Ждем реакции интерфейса

      // 2. ОЧИСТКА (на всякий случай)
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await sleep(500);

      // 3. ЭМУЛЯЦИЯ ПОБУКВЕННОГО ВВОДА (Самый надежный способ для React)
      console.log("⌨️ Печатаем текст...");
      
      // Сначала вводим первый символ "силой", чтобы сбить placeholder
      const firstChar = postData.text.charAt(0);
      const remainingText = postData.text.slice(1);
      
      // Эмулируем нажатие клавиши
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: firstChar, bubbles: true }));
      editor.dispatchEvent(new KeyboardEvent('keypress', { key: firstChar, bubbles: true }));
      document.execCommand('insertText', false, firstChar);
      editor.dispatchEvent(new KeyboardEvent('keyup', { key: firstChar, bubbles: true }));
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      
      await sleep(100);

      // Остальной текст вставляем блоком (чтобы быстрее)
      if (remainingText) {
          document.execCommand('insertText', false, remainingText);
          editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      await sleep(1500);
      
      // Проверка: если текст не появился, используем запасной Paste
      if (editor.innerText.trim().length === 0) {
          console.warn("⚠️ insertText не сработал, пробуем Paste...");
          const dataTransfer = new DataTransfer();
          dataTransfer.setData('text/plain', postData.text);
          const pasteEvent = new ClipboardEvent('paste', {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true
          });
          editor.dispatchEvent(pasteEvent);
          // Если paste не перехвачен, вставляем вручную
          if (!pasteEvent.defaultPrevented) {
             editor.innerText = postData.text;
             editor.dispatchEvent(new Event('input', { bubbles: true }));
          }
      }

  } else {
      console.error("❌ Редактор текста не найден!");
  }

  // --- ЭТАП 3: ОПЦИИ (Bullish) ---
  const bullishBtn = Array.from(document.querySelectorAll('div, button, span')).find(el => el.innerText.trim() === 'Bullish');
  if (bullishBtn) {
      bullishBtn.click();
      await sleep(500);
  }

  // --- ЭТАП 4: ФОТО ---
  if (postData.image) {
    console.log("🖼 Загружаем фото...");
    
    const gifIcon = Array.from(document.querySelectorAll('div, span, button')).find(el => el.innerText === 'GIF');
    let fileInput = document.querySelector('input[type="file"]');
    
    if (!fileInput && gifIcon) {
        const imageIconBtn = gifIcon.previousElementSibling || gifIcon.parentElement.previousElementSibling;
        if (imageIconBtn) {
            imageIconBtn.click();
            await sleep(1000);
            fileInput = document.querySelector('input[type="file"]');
        }
    }
    
    if (!fileInput) { 
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
    console.error("❌ Кнопка Post неактивна.");
  }
}
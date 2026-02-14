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
  console.log("🚀 Авто-постер CMC запущен v5 (Paste Strategy)", postData);
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

  // --- ЭТАП 2: ВВОД ТЕКСТА (СТРАТЕГИЯ PASTE) ---
  console.log("📝 Ищем редактор...");
  
  const editors = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
  const editor = editors[editors.length - 1];

  if (editor) {
      console.log("✍️ Редактор найден. Активируем фокус...");
      
      // 1. ФОКУС И УСТАНОВКА КУРСОРА
      editor.focus();
      editor.click();
      await sleep(500);

      // Устанавливаем курсор (Caret) внутрь редактора, даже если он "пустой"
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false); // В конец
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      await sleep(500);

      // 2. ЭМУЛЯЦИЯ ВСТАВКИ (PASTE) - ЭТО ГЛАВНЫЙ ФИКС
      // React редакторы (DraftJS, Slate) отлично обрабатывают событие Paste, 
      // обновляя свой внутренний state.
      console.log("📋 Эмулируем вставку текста...");

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', postData.text);
      
      const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
      });
      
      editor.dispatchEvent(pasteEvent);
      
      await sleep(1000);

      // 3. ПРОВЕРКА И ЗАПАСНОЙ ВАРИАНТ (textInput)
      // Если текст все еще не появился или placeholder на месте
      if (editor.innerText.trim().length === 0 || document.querySelector('.public-DraftEditorPlaceholder-root')) {
          console.warn("⚠️ Paste не сработал, пробуем textInput event...");
          
          const textInputEvent = new InputEvent('textInput', {
              data: postData.text,
              bubbles: true,
              cancelable: true,
              view: window
          });
          editor.dispatchEvent(textInputEvent);
          
          // И еще один вариант - просто input
          const inputEvent = new InputEvent('input', {
              data: postData.text,
              inputType: 'insertText',
              bubbles: true
          });
          editor.dispatchEvent(inputEvent);
      }

  } else {
      console.error("❌ Редактор текста не найден!");
  }

  await sleep(1000);

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
    console.error("❌ Кнопка Post неактивна. Попробуйте кликнуть вручную.");
  }
}
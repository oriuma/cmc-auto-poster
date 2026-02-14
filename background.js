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
  console.log("🚀 Авто-постер CMC запущен", postData);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // --- ЭТАП 1: ПОИСК И ОТКРЫТИЕ МОДАЛКИ (как раньше) ---
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
  await sleep(3000);

  // --- ЭТАП 2: ВВОД ТЕКСТА (ИСПРАВЛЕНО) ---
  console.log("📝 Ищем редактор...");
  // На скриншоте видно placeholder "How do you feel...". Ищем по нему.
  // Обычно это div с contenteditable="true"
  const editors = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
  // Берем последний видимый
  let editor = editors[editors.length - 1];

  if (!editor) {
      // Запасной вариант: ищем по тексту placeholder'а (он часто лежит в соседнем div)
      const placeholders = Array.from(document.querySelectorAll('div'));
      const placeholder = placeholders.find(el => el.innerText.includes("How do you feel about the markets"));
      if (placeholder) {
          // Редактор обычно рядом с placeholder или это родительский элемент
          // Кликаем по placeholder, чтобы активировать фокус
          placeholder.click();
          await sleep(500);
          // После клика фокус должен быть в редакторе
          editor = document.activeElement; 
      }
  }

  if (editor) {
      console.log("✍️ Активируем редактор и пишем...");
      // 1. Сначала кликаем, чтобы убрать "серый" текст placeholder'а
      editor.click();
      editor.focus();
      await sleep(1000); // Важно подождать, пока React отработает фокус

      // 2. Вводим текст через execCommand (самый надежный способ для rich text редакторов)
      document.execCommand('insertText', false, postData.text);
      
      // 3. Если текст не вставился, пробуем запасной метод (прямая вставка + событие input)
      if (!editor.innerText || editor.innerText.trim() === "") {
           editor.innerText = postData.text;
           editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await sleep(1500);
  } else {
      console.error("❌ Редактор не найден");
  }

  // --- ЭТАП 3: ВЫБОР BULLISH/BEARISH (ОПЦИОНАЛЬНО, КАК НА СКРИНЕ) ---
  // На скриншоте видно кнопки Bullish / Bearish. Можно кликнуть Bullish для красоты.
  const bullishBtn = Array.from(document.querySelectorAll('div, button, span')).find(el => el.innerText.trim() === 'Bullish');
  if (bullishBtn) {
      bullishBtn.click();
      await sleep(500);
  }

  // --- ЭТАП 4: ЗАГРУЗКА ФОТО (ИСПРАВЛЕНО) ---
  if (postData.image) {
    console.log("🖼 Загружаем фото...");
    
    // 1. Сначала ищем кнопку-иконку картинки, чтобы "активировать" зону загрузки (иногда input создается только после клика)
    // Ищем иконку, которая похожа на "image" или "picture". Обычно это svg.
    // На скрине это первая иконка слева в ряду иконок.
    
    // Попробуем найти input[type=file] сразу. Если он есть в DOM, используем его.
    let fileInput = document.querySelector('input[type="file"]');
    
    if (!fileInput) {
        // Если инпута нет, кликаем по иконке картинки. 
        // Это обычно кнопка с svg внутри, рядом с кнопкой GIF.
        // Ищем элемент, который содержит svg и находится рядом с GIF
        const gifIcon = Array.from(document.querySelectorAll('div, span, button')).find(el => el.innerText === 'GIF');
        if (gifIcon) {
            // Иконка картинки обычно СЛЕВА от GIF. Берем предыдущего соседа.
            const imageIconBtn = gifIcon.previousElementSibling || gifIcon.parentElement.previousElementSibling;
            if (imageIconBtn) {
                imageIconBtn.click();
                await sleep(1000); // Ждем появления инпута
                fileInput = document.querySelector('input[type="file"]');
            }
        }
    }

    // Если все еще нет input, ищем просто последний file input на странице
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
        await sleep(5000); // Ждем превью
      } catch (e) {
        console.error("Ошибка обработки файла:", e);
      }
    } else {
        console.error("❌ Input для загрузки файла так и не появился.");
    }
  }

  // --- ЭТАП 5: ПУБЛИКАЦИЯ ---
  console.log("🚀 Нажимаем Post...");
  const postBtns = Array.from(document.querySelectorAll('button'));
  const finalPostBtn = postBtns.find(b => b.innerText.trim() === 'Post' && !b.disabled);

  if (finalPostBtn) {
    finalPostBtn.click();
    console.log("✅ Готово!");
  } else {
    console.error("❌ Кнопка Post не найдена/неактивна");
  }
}
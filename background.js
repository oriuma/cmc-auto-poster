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
      console.log('🚀 Начинаю публикацию:', pendingPost.id);
      performPost(pendingPost);
    }
  });
}

function performPost(post) {
  const platforms = post.platforms || ['cmc'];
  
  platforms.forEach((platform, index) => {
    setTimeout(() => {
      if (platform === 'cmc') {
        postToCMC(post);
      } else if (platform === 'binance') {
        postToBinance(post);
      }
    }, index * 10000); // 10 секунд между платформами
  });

  setTimeout(() => {
    removePost(post.id);
  }, platforms.length * 10000 + 30000);
}

function removePost(id) {
  chrome.storage.local.get({ posts: [] }, (result) => {
    const posts = result.posts.filter(p => p.id !== id);
    chrome.storage.local.set({ posts: posts });
  });
}

// Вспомогательная функция ожидания загрузки страницы
function waitForPageLoad(tabId, callback) {
  let attempts = 0;
  const maxAttempts = 40; // 40 секунд максимум
  
  const checkInterval = setInterval(() => {
    chrome.tabs.get(tabId, (tab) => {
      attempts++;
      
      // Проверяем статус загрузки
      if (tab.status === 'complete' || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        // Дополнительная пауза после "complete" для React-приложений
        setTimeout(() => callback(), 3000);
      }
    });
  }, 1000);
}

// === CMC MODULE ===
function postToCMC(post) {
  const targetUrl = 'https://coinmarketcap.com/community/profile/cointhinker/';
  
  chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
    // Ждем полной загрузки страницы
    waitForPageLoad(tab.id, () => {
      // Сначала внедряем визуальный индикатор
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectVisualIndicator,
        args: ['CMC']
      });
      
      // Затем выполняем основной скрипт
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: cmcPoster,
          args: [post]
        });
      }, 2000);
    });
  });
}

// Визуальный индикатор работы расширения
function injectVisualIndicator(platformName) {
  // Создаем стильный floating badge
  const badge = document.createElement('div');
  badge.id = 'auto-poster-indicator';
  badge.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 25px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.5s ease-out, pulse 2s ease-in-out infinite;
    ">
      <div style="
        width: 8px;
        height: 8px;
        background: #4ade80;
        border-radius: 50%;
        animation: blink 1s ease-in-out infinite;
      "></div>
      <span>🤖 Auto-Posting to ${platformName}...</span>
    </div>
  `;
  
  // Добавляем анимации
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    @keyframes sparkle {
      0% { transform: translateY(0) scale(1); opacity: 1; }
      100% { transform: translateY(-100px) scale(0); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(badge);
  
  // Создаем эффект "sparkles" (блестки)
  const createSparkle = () => {
    const sparkle = document.createElement('div');
    const x = Math.random() * window.innerWidth;
    sparkle.style.cssText = `
      position: fixed;
      left: ${x}px;
      bottom: 0;
      width: 4px;
      height: 4px;
      background: linear-gradient(135deg, #ffd700, #ff6b6b);
      border-radius: 50%;
      pointer-events: none;
      z-index: 999998;
      animation: sparkle 3s ease-out forwards;
    `;
    document.body.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 3000);
  };
  
  // Генерируем блестки каждые 500мс
  const sparkleInterval = setInterval(createSparkle, 500);
  
  // Удаляем индикатор через 60 секунд (на случай долгой работы)
  setTimeout(() => {
    clearInterval(sparkleInterval);
    badge.remove();
  }, 60000);
}

async function cmcPoster(postData) {
  console.log("📊 CMC Auto-Poster v6", postData);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Поиск кнопки (увеличено время ожидания)
  let postButton = null;
  for (let i = 0; i < 20; i++) { // Было 15, стало 20
    window.scrollBy(0, 500);
    await sleep(2000); // Было 1500, стало 2000

    const specificButton = document.querySelector('.iSUEMj.post.button');
    const iconButton = document.querySelector('use[href="#new-feed"]');
    
    if (specificButton) postButton = specificButton;
    else if (iconButton) postButton = iconButton.closest('div[role="button"]') || iconButton.closest('div.post.button');

    if (postButton) {
      postButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(1500);
      break;
    }
  }

  if (!postButton) return console.error("❌ CMC: Button not found");
  postButton.click();
  await sleep(5000); // Было 4000, стало 5000

  // Ввод текста
  const editors = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
  const editor = editors[editors.length - 1];

  if (editor) {
    editor.focus();
    editor.click();
    await sleep(1000);

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    await sleep(500);

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', postData.text);
    const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
    });
    editor.dispatchEvent(pasteEvent);
    await sleep(2000); // Было 1000, стало 2000
  }

  // Bullish
  const bullishBtn = Array.from(document.querySelectorAll('div, button, span')).find(el => el.innerText.trim() === 'Bullish');
  if (bullishBtn) {
    bullishBtn.click();
    await sleep(500);
  }

  // Фото
  if (postData.image) {
    const gifIcon = Array.from(document.querySelectorAll('div, span, button')).find(el => el.innerText === 'GIF');
    let fileInput = document.querySelector('input[type="file"]');
    
    if (!fileInput && gifIcon) {
      const imageIconBtn = gifIcon.previousElementSibling || gifIcon.parentElement.previousElementSibling;
      if (imageIconBtn) {
        imageIconBtn.click();
        await sleep(2000); // Было 1000
        fileInput = document.querySelector('input[type="file"]');
      }
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
        await sleep(6000); // Было 5000, стало 6000
      } catch (e) { console.error(e); }
    }
  }

  // Публикация
  const postBtns = Array.from(document.querySelectorAll('button'));
  const finalPostBtn = postBtns.find(b => b.innerText.trim() === 'Post' && !b.disabled);
  if (finalPostBtn) {
    finalPostBtn.click();
    console.log("✅ CMC: Success!");
    
    // Убираем индикатор после успеха
    setTimeout(() => {
      const indicator = document.getElementById('auto-poster-indicator');
      if (indicator) indicator.remove();
    }, 2000);
  }
}

// === BINANCE MODULE ===
function postToBinance(post) {
  const targetUrl = 'https://www.binance.com/en/square';
  
  chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
    waitForPageLoad(tab.id, () => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectVisualIndicator,
        args: ['Binance Square']
      });
      
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: binancePoster,
          args: [post]
        });
      }, 2000);
    });
  });
}

async function binancePoster(postData) {
  console.log("🟫 Binance Square Auto-Poster v6", postData);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Поиск поля ввода (увеличено время)
  let editor = null;
  for (let i = 0; i < 15; i++) { // Было 10, стало 15
    const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"], textarea, input[type="text"]'));
    editor = allEditables.find(el => {
      const placeholder = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '';
      return placeholder.toLowerCase().includes('share your thoughts');
    });

    if (editor) break;
    await sleep(2500); // Было 2000, стало 2500
  }

  if (!editor) return console.error("❌ Binance: Editor not found");

  console.log("✍️ Binance: Found editor");
  editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(1500);
  editor.focus();
  editor.click();
  await sleep(1500);

  // Ввод текста
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  await sleep(500);

  const dataTransfer = new DataTransfer();
  dataTransfer.setData('text/plain', postData.text);
  const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
  });
  editor.dispatchEvent(pasteEvent);
  await sleep(2000);

  // Загрузка картинки
  if (postData.image) {
    console.log("🖼 Binance: Uploading image...");
    
    const imageSvg = document.querySelector('svg path[fill-rule="evenodd"][clip-rule="evenodd"]');
    let imageButton = imageSvg ? imageSvg.closest('button') || imageSvg.closest('div[role="button"]') : null;
    
    if (imageButton) {
      imageButton.click();
      await sleep(2000); // Было 1500
    }

    let fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) {
      const inputs = document.querySelectorAll('input[type="file"]');
      fileInput = inputs[inputs.length - 1];
    }

    if (fileInput) {
      try {
        const res = await fetch(postData.image);
        const blob = await res.blob();
        const file = new File([blob], "image.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(6000); // Было 5000
      } catch (e) { console.error("❌ Binance image error:", e); }
    }
  }

  // Поиск желтой кнопки Post
  console.log("🚀 Binance: Looking for Post button...");
  const allButtons = Array.from(document.querySelectorAll('button'));
  const postBtn = allButtons.find(b => {
    const text = b.innerText.trim().toLowerCase();
    const style = window.getComputedStyle(b);
    const bgColor = style.backgroundColor;
    const isYellow = bgColor.includes('240, 185') || bgColor.includes('252, 213') || bgColor.includes('248, 194');
    return (text === 'post' || text === 'publish' || text === 'submit') && isYellow;
  });

  if (postBtn && !postBtn.disabled) {
    postBtn.click();
    console.log("✅ Binance: Success!");
    
    setTimeout(() => {
      const indicator = document.getElementById('auto-poster-indicator');
      if (indicator) indicator.remove();
    }, 2000);
  } else {
    console.error("❌ Binance: Post button not found or disabled");
  }
}
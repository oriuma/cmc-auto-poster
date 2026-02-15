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
  // Публикуем на все выбранные платформы
  const platforms = post.platforms || ['cmc']; // Запасное значение
  
  platforms.forEach((platform, index) => {
    // Задержка между платформами, чтобы не открывались одновременно
    setTimeout(() => {
      if (platform === 'cmc') {
        postToCMC(post);
      } else if (platform === 'binance') {
        postToBinance(post);
      }
    }, index * 5000); // 5 секунд между платформами
  });

  // Удаляем пост из очереди после публикации на всех платформах
  setTimeout(() => {
    removePost(post.id);
  }, platforms.length * 5000 + 20000);
}

function removePost(id) {
  chrome.storage.local.get({ posts: [] }, (result) => {
    const posts = result.posts.filter(p => p.id !== id);
    chrome.storage.local.set({ posts: posts });
  });
}

// === CMC MODULE ===
function postToCMC(post) {
  const targetUrl = 'https://coinmarketcap.com/community/profile/cointhinker/';
  
  chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: cmcPoster,
        args: [post]
      });
    }, 15000);
  });
}

async function cmcPoster(postData) {
  console.log("📊 CMC Auto-Poster v5", postData);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Поиск кнопки
  let postButton = null;
  for (let i = 0; i < 15; i++) {
    window.scrollBy(0, 500);
    await sleep(1500);

    const specificButton = document.querySelector('.iSUEMj.post.button');
    const iconButton = document.querySelector('use[href="#new-feed"]');
    
    if (specificButton) postButton = specificButton;
    else if (iconButton) postButton = iconButton.closest('div[role="button"]') || iconButton.closest('div.post.button');

    if (postButton) {
      postButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(1000);
      break;
    }
  }

  if (!postButton) return console.error("❌ CMC: Button not found");
  postButton.click();
  await sleep(4000);

  // Ввод текста
  const editors = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
  const editor = editors[editors.length - 1];

  if (editor) {
    editor.focus();
    editor.click();
    await sleep(500);

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
    await sleep(1000);
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
        await sleep(1000);
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
        await sleep(5000);
      } catch (e) { console.error(e); }
    }
  }

  // Публикация
  const postBtns = Array.from(document.querySelectorAll('button'));
  const finalPostBtn = postBtns.find(b => b.innerText.trim() === 'Post' && !b.disabled);
  if (finalPostBtn) {
    finalPostBtn.click();
    console.log("✅ CMC: Success!");
  }
}

// === BINANCE MODULE ===
function postToBinance(post) {
  const targetUrl = 'https://www.binance.com/en/square';
  
  chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: binancePoster,
        args: [post]
      });
    }, 15000);
  });
}

async function binancePoster(postData) {
  console.log("🟫 Binance Square Auto-Poster", postData);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Поиск поля ввода с placeholder "Share your thoughts"
  let editor = null;
  for (let i = 0; i < 10; i++) {
    const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"], textarea, input[type="text"]'));
    editor = allEditables.find(el => {
      const placeholder = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '';
      return placeholder.toLowerCase().includes('share your thoughts');
    });

    if (editor) break;
    await sleep(2000);
  }

  if (!editor) return console.error("❌ Binance: Editor not found");

  console.log("✍️ Binance: Found editor");
  editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(1000);
  editor.focus();
  editor.click();
  await sleep(1000);

  // Ввод текста (Paste strategy)
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
  await sleep(1500);

  // Загрузка картинки
  if (postData.image) {
    console.log("🖼 Binance: Uploading image...");
    
    // Ищем иконку по селектору SVG (path с fill-rule)
    const imageSvg = document.querySelector('svg path[fill-rule="evenodd"][clip-rule="evenodd"]');
    let imageButton = imageSvg ? imageSvg.closest('button') || imageSvg.closest('div[role="button"]') : null;
    
    if (imageButton) {
      imageButton.click();
      await sleep(1500);
    }

    // Ищем file input
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
        await sleep(5000);
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
    // Желтый цвет Binance (rgb(240, 185, 11) или похожий)
    const isYellow = bgColor.includes('240, 185') || bgColor.includes('252, 213') || bgColor.includes('248, 194');
    return (text === 'post' || text === 'publish' || text === 'submit') && isYellow;
  });

  if (postBtn && !postBtn.disabled) {
    postBtn.click();
    console.log("✅ Binance: Success!");
  } else {
    console.error("❌ Binance: Post button not found or disabled");
  }
}
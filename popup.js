document.addEventListener('DOMContentLoaded', loadPosts);
document.getElementById('scheduleBtn').addEventListener('click', schedulePost);

async function schedulePost() {
  const text = document.getElementById('postText').value;
  const timeInput = document.getElementById('postTime').value;
  const fileInput = document.getElementById('postImage');
  const status = document.getElementById('status');

  // Проверка выбранных платформ
  const platforms = [];
  if (document.getElementById('platformCMC').checked) platforms.push('cmc');
  if (document.getElementById('platformBinance').checked) platforms.push('binance');

  if (!text || !timeInput) {
    status.textContent = "⚠️ Enter text and time!";
    status.style.background = '#f8d7da';
    status.style.color = '#721c24';
    setTimeout(() => status.textContent = '', 3000);
    return;
  }

  if (platforms.length === 0) {
    status.textContent = "⚠️ Select at least one platform!";
    status.style.background = '#f8d7da';
    status.style.color = '#721c24';
    setTimeout(() => status.textContent = '', 3000);
    return;
  }

  const scheduledTime = new Date(timeInput).getTime();
  if (scheduledTime <= Date.now()) {
    status.textContent = "⚠️ Time must be in the future!";
    status.style.background = '#f8d7da';
    status.style.color = '#721c24';
    setTimeout(() => status.textContent = '', 3000);
    return;
  }

  let imageData = null;
  if (fileInput.files.length > 0) {
    try {
      imageData = await convertToBase64(fileInput.files[0]);
    } catch (e) {
      status.textContent = "❌ Image error: " + e;
      status.style.background = '#f8d7da';
      status.style.color = '#721c24';
      return;
    }
  }

  const post = {
    id: Date.now(),
    text: text,
    image: imageData,
    time: scheduledTime,
    platforms: platforms,
    status: 'pending'
  };

  chrome.storage.local.get({ posts: [] }, (result) => {
    const posts = result.posts;
    posts.push(post);
    chrome.storage.local.set({ posts: posts }, () => {
      status.textContent = "✅ Post scheduled!";
      status.style.background = '#d4edda';
      status.style.color = '#155724';
      loadPosts();
      // Очистка
      document.getElementById('postText').value = '';
      document.getElementById('postImage').value = '';
      setTimeout(() => status.textContent = '', 3000);
    });
  });
}

function loadPosts() {
  chrome.storage.local.get({ posts: [] }, (result) => {
    const list = document.getElementById('postsList');
    list.innerHTML = '';
    
    if (result.posts.length === 0) {
      list.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No scheduled posts yet</div>';
      return;
    }
    
    result.posts.sort((a, b) => a.time - b.time).forEach(post => {
      const div = document.createElement('div');
      div.className = 'post-item';
      const dateStr = new Date(post.time).toLocaleString();
      
      let imgHtml = post.image ? `<img src="${post.image}" class="preview">` : '';
      
      const platformBadges = post.platforms.map(p => {
        const names = { cmc: 'CMC', binance: 'Binance' };
        return `<span class="platform-badge">${names[p]}</span>`;
      }).join('');
      
      div.innerHTML = `
        <div class="post-content">
          <div class="post-time">${dateStr}</div>
          <div class="post-text">${post.text.substring(0, 50)}${post.text.length > 50 ? '...' : ''}</div>
          <div class="post-platforms">${platformBadges}</div>
          ${imgHtml}
        </div>
        <span class="delete-btn" data-id="${post.id}">×</span>
      `;
      list.appendChild(div);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        deletePost(Number(e.target.dataset.id));
      });
    });
  });
}

function deletePost(id) {
  chrome.storage.local.get({ posts: [] }, (result) => {
    const posts = result.posts.filter(p => p.id !== id);
    chrome.storage.local.set({ posts: posts }, loadPosts);
  });
}

function convertToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}
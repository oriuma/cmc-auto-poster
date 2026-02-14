document.addEventListener('DOMContentLoaded', loadPosts);
document.getElementById('scheduleBtn').addEventListener('click', schedulePost);

async function schedulePost() {
  const text = document.getElementById('postText').value;
  const timeInput = document.getElementById('postTime').value;
  const fileInput = document.getElementById('postImage');
  const status = document.getElementById('status');

  if (!text || !timeInput) {
    status.textContent = "Введите текст и время!";
    return;
  }

  const scheduledTime = new Date(timeInput).getTime();
  if (scheduledTime <= Date.now()) {
    status.textContent = "Время должно быть в будущем!";
    return;
  }

  let imageData = null;
  if (fileInput.files.length > 0) {
    try {
      imageData = await convertToBase64(fileInput.files[0]);
    } catch (e) {
      status.textContent = "Ошибка фото: " + e;
      return;
    }
  }

  const post = {
    id: Date.now(),
    text: text,
    image: imageData,
    time: scheduledTime,
    status: 'pending'
  };

  chrome.storage.local.get({ posts: [] }, (result) => {
    const posts = result.posts;
    posts.push(post);
    chrome.storage.local.set({ posts: posts }, () => {
      status.textContent = "Сохранено!";
      loadPosts();
      // Очистка формы
      document.getElementById('postText').value = '';
      document.getElementById('postImage').value = '';
    });
  });
}

function loadPosts() {
  chrome.storage.local.get({ posts: [] }, (result) => {
    const list = document.getElementById('postsList');
    list.innerHTML = '';
    
    result.posts.sort((a, b) => a.time - b.time).forEach(post => {
      const div = document.createElement('div');
      div.className = 'post-item';
      const dateStr = new Date(post.time).toLocaleString();
      
      let imgHtml = post.image ? `<img src="${post.image}" class="preview">` : '';
      
      div.innerHTML = `
        <strong>${dateStr}</strong><br>
        ${post.text.substring(0, 30)}...
        ${imgHtml}
        <span class="delete-btn" data-id="${post.id}">[X]</span>
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
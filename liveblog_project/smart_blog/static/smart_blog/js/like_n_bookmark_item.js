// static/js/like.js
(function () {
  'use strict';

  function getCookie(name) {
    return document.cookie
      .split('; ')
      .find(c => c.startsWith(name + '='))
      ?.split('=')[1];
  }

  document.addEventListener('click', async function (e) {
    const btn = e.target.closest('.like-btn');
    if (!btn) return;

    e.preventDefault();

    const url = btn.dataset.url;
    const itemId = btn.dataset.itemId;
    const icon = btn.querySelector('i');

    if (!url || !icon) return;

    btn.classList.add('opacity-50');

    try {
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin', // ВОТ
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        console.error('LIKE ERROR', resp.status);
        return;
      }

      icon.classList.toggle('fa-heart', data.liked);
      icon.classList.toggle('fa-heart-o', !data.liked);

      icon.classList.add('btn-bounce');
      setTimeout(() => icon.classList.remove('btn-bounce'), 300);

      // sync listing
      try {
        const key = 'listing_changes';
        const changes = JSON.parse(sessionStorage.getItem(key) || '{}');
        changes[itemId] = changes[itemId] || {};
        changes[itemId].likes_count = data.likes_count;
        changes[itemId].liked = data.liked;
        sessionStorage.setItem(key, JSON.stringify(changes));
      } catch { }

      const detailLikes = document.getElementById('likesCount');
      if (detailLikes && data.likes_count != null) {
        detailLikes.textContent = data.likes_count;
      }

    } finally {
      btn.classList.remove('opacity-50');
    }
  });

})();



// static/js/bookmark.js
(function () {
  'use strict';

  function getCookie(name) {
    return document.cookie
      .split('; ')
      .find(c => c.startsWith(name + '='))
      ?.split('=')[1];
  }

  document.addEventListener('click', async function (e) {
    const btn = e.target.closest('.bookmark-btn');
    if (!btn) return;

    e.preventDefault();

    const url = btn.dataset.url;
    const itemId = btn.dataset.itemId;
    const icon = btn.querySelector('i');

    if (!url || !icon) return;

    btn.classList.add('opacity-50');

    try {
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin', // ВОТ
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        console.error('LIKE ERROR', resp.status);
        return;
      }

      if (!resp.ok) {
        console.error('LIKE ERROR', resp.status);
        return;
      }

      icon.classList.toggle('fa-bookmark', data.bookmarked);
      icon.classList.toggle('fa-bookmark-o', !data.bookmarked);

      icon.classList.add('btn-bounce');
      setTimeout(() => icon.classList.remove('btn-bounce'), 300);

      // sync listing
      try {
        const key = 'listing_changes';
        const changes = JSON.parse(sessionStorage.getItem(key) || '{}');
        changes[itemId] = changes[itemId] || {};
        changes[itemId].bookmarks_count = data.bookmarks_count;
        changes[itemId].bookmarked = data.bookmarked;
        sessionStorage.setItem(key, JSON.stringify(changes));
      } catch { }

      // instant detail update
      const detailBookmarks = document.getElementById('bookmarkCount');
      if (detailBookmarks && data.bookmarks_count != null) {
        detailBookmarks.textContent = data.bookmarks_count;
      }

    } finally {
      btn.classList.remove('opacity-50');
    }
  });
})();
// static/js/like.js
(function () {
  'use strict';

  function humanCount(n) {
    n = Number(n);
    if (isNaN(n) || n < 0) return '0';
    if (n < 1000) return String(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

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
    e.stopPropagation();

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

      // if we came from profile listing, ensure it refreshes on return
      try {
        const listingUrl = sessionStorage.getItem('listing_url') || '';
        if (data.liked === true && listingUrl.includes('/profile/')) {
          sessionStorage.setItem('profile_refresh_needed', '1');
          sessionStorage.setItem('profile_refresh_section', 'liked');
        }
      } catch { }

      // sync listing
      try {
        const key = 'listing_changes';
        const changes = JSON.parse(sessionStorage.getItem(key) || '{}');
        changes[itemId] = changes[itemId] || {};
        changes[itemId].likes_count = data.likes_count;
        changes[itemId].liked = data.liked;
        changes[itemId].user_id = document.body.dataset.userId || '';
        if (typeof data.views_count === 'number') changes[itemId].views_count = data.views_count;
        sessionStorage.setItem(key, JSON.stringify(changes));
        try { localStorage.setItem('brainews_filter_refresh_needed', '1'); } catch (e) { }
        try { document.dispatchEvent(new CustomEvent('brainews-filter-refresh')); } catch (e) { }
      } catch { }

      const detailLikes = document.getElementById('likesCount');
      if (detailLikes && data.likes_count != null) {
        detailLikes.textContent = humanCount(data.likes_count);
      }
      const cardLikes = document.getElementById('likes-count-' + itemId);
      if (cardLikes && data.likes_count != null) {
        cardLikes.textContent = humanCount(data.likes_count);
      }
      if (window.updateLikedUsersUI) {
        window.updateLikedUsersUI(data);
      }

    } finally {
      btn.classList.remove('opacity-50');
    }
  });

})();



// static/js/bookmark.js
(function () {
  'use strict';

  function humanCount(n) {
    n = Number(n);
    if (isNaN(n) || n < 0) return '0';
    if (n < 1000) return String(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

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

      // if we came from profile listing, ensure it refreshes on return
      try {
        const listingUrl = sessionStorage.getItem('listing_url') || '';
        if (data.bookmarked === true && listingUrl.includes('/profile/')) {
          sessionStorage.setItem('profile_refresh_needed', '1');
          sessionStorage.setItem('profile_refresh_section', 'bookmarked');
        }
      } catch { }

      // sync listing
      try {
        const key = 'listing_changes';
        const changes = JSON.parse(sessionStorage.getItem(key) || '{}');
        changes[itemId] = changes[itemId] || {};
        changes[itemId].bookmarks_count = data.bookmarks_count;
        changes[itemId].bookmarked = data.bookmarked;
        changes[itemId].user_id = document.body.dataset.userId || '';
        if (typeof data.views_count === 'number') changes[itemId].views_count = data.views_count;
        sessionStorage.setItem(key, JSON.stringify(changes));
        try { localStorage.setItem('brainews_filter_refresh_needed', '1'); } catch (e) { }
        try { document.dispatchEvent(new CustomEvent('brainews-filter-refresh')); } catch (e) { }
      } catch { }

      // instant detail update
      const detailBookmarks = document.getElementById('bookmarkCount');
      if (detailBookmarks && data.bookmarks_count != null) {
        detailBookmarks.textContent = humanCount(data.bookmarks_count);
      }
      const cardBookmarks = document.getElementById('bookmark-count-' + itemId);
      if (cardBookmarks && data.bookmarks_count != null) {
        cardBookmarks.textContent = humanCount(data.bookmarks_count);
      }

    } finally {
      btn.classList.remove('opacity-50');
    }
  });
})();
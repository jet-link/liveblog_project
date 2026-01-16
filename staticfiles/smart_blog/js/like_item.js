// static/js/like.js
(function () {
  'use strict';

  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const c = cookies[i].trim();
        if (c.startsWith(name + '=')) {
          cookieValue = decodeURIComponent(c.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const likeBtn = document.getElementById('likeBtn');
    if (!likeBtn) return;

    const likeIcon = document.getElementById('likeIcon');
    const likesCountNode = document.getElementById('likesCount'); // hidden on detail
    const itemId = likeBtn.dataset.itemId || document.body.dataset.itemId;
    const url = likeBtn.dataset.url;

    likeBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      if (!url) return;

      // visual feedback
      likeBtn.classList.add('opacity-50');

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
          }
        });

        const data = await resp.json().catch(() => null);

        if (!resp.ok || !data || !data.success) {
          console.warn(data && data.error ? data.error : 'Error toggling like');
          return;
        }

        // update UI on detail
        if (likeIcon) {
          if (data.liked) {
            likeIcon.classList.remove('fa-heart-o');
            likeIcon.classList.add('fa-heart');
          } else {
            likeIcon.classList.remove('fa-heart');
            likeIcon.classList.add('fa-heart-o');
          }

          // animation (bounce)
          likeIcon.classList.add('btn-bounce');
          setTimeout(() => likeIcon.classList.remove('btn-bounce'), 300);
        }

        if (likesCountNode && typeof data.likes_count !== 'undefined') {
          likesCountNode.textContent = data.likes_count;
        }

        // save changes into listing_changes for the list page
        try {
          const key = 'listing_changes';
          let changes = {};
          try { changes = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (e) { changes = {}; }
          changes[itemId] = changes[itemId] || {};
          if (typeof data.likes_count !== 'undefined') changes[itemId].likes_count = data.likes_count;
          if (typeof data.liked !== 'undefined') changes[itemId].liked = data.liked;
          if (typeof data.total_views !== 'undefined') changes[itemId].views_count = data.total_views;
          sessionStorage.setItem(key, JSON.stringify(changes));
        } catch (e) { /* ignore */ }

      } catch (err) {
        console.error('LIKE AJAX ERROR:', err);
      } finally {
        likeBtn.classList.remove('opacity-50');
      }
    });
  });
})();
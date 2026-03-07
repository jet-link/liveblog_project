(function () {
  'use strict';

  const stackTrigger = document.getElementById('likedUsersStackTrigger') || document.querySelector('.liked-users-stack');
  const noLikesYet = document.getElementById('noLikesYet');
  const likedUsersContainer = document.getElementById('likedUsersContainer');
  const overlay = document.getElementById('likedUsersOverlay');
  const closeBtn = document.getElementById('likedUsersClose');
  const backdrop = overlay?.querySelector('.liked-users-backdrop');
  const stack = document.querySelector('.liked-users-stack');
  const list = overlay?.querySelector('.liked-users-list');
  const current = document.getElementById('likedUsersCurrent');
  if (!overlay) return;

  function updateListMaxHeight() {
    if (!list) return;
    const sample = list.querySelector('.liked-users-item');
    if (!sample) {
      list.style.maxHeight = '';
      return;
    }
    const styles = window.getComputedStyle(list);
    const gap = parseFloat(styles.rowGap || styles.gap || 0) || 0;
    const itemHeight = sample.getBoundingClientRect().height || 0;
    if (!itemHeight) return;
    const target = Math.round(itemHeight * 10 + gap * 9);
    list.style.maxHeight = `${target}px`;
    list.style.overflowY = 'auto';
  }

  function openOverlay() {
    updateListMaxHeight();
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    if (overlay.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    stackTrigger?.focus({ preventScroll: true });
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  function openOnClick(e) {
    e.preventDefault();
    if (!likedUsersContainer || likedUsersContainer.style.display === 'none') return;
    openOverlay();
  }
  stackTrigger?.addEventListener('click', openOnClick);
  stackTrigger?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openOnClick(e);
    }
  });
  closeBtn?.addEventListener('click', closeOverlay);
  backdrop?.addEventListener('click', closeOverlay);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlay();
  });
  list?.addEventListener('click', (e) => {
    const link = e.target.closest?.('a');
    if (!link) return;
    closeOverlay();
  });
  window.addEventListener('pagehide', closeOverlay);
  window.addEventListener('pageshow', closeOverlay);
  window.addEventListener('resize', () => {
    updateListMaxHeight();
  });

  function upsertListItem(username, avatarUrl, profileUrl) {
    if (!list) return;
    const existing = list.querySelector(`[data-like-user="${username}"]`);
    if (existing) return;
    const row = document.createElement('a');
    row.href = profileUrl || '#';
    row.className = 'liked-users-item d-flex align-items-center gap-2 text-decoration-none';
    row.dataset.likeUser = username;
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'liked-user-avatar little-avatar';
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = username;
    img.className = 'user-avatar';
    img.width = 30;
    img.height = 30;
    img.decoding = 'async';
    img.loading = 'lazy';
    img.onerror = function () { this.onerror = null; this.classList.add('avatar-load-failed'); };
    avatarWrap.appendChild(img);
    const badge = document.createElement('span');
    badge.className = 'custom_badge badge_primary';
    badge.textContent = username;
    row.appendChild(avatarWrap);
    row.appendChild(badge);
    list.prepend(row);
  }

  function removeListItem(username) {
    if (!list) return;
    const existing = list.querySelector(`[data-like-user="${username}"]`);
    if (existing) existing.remove();
  }

  function syncStackFromList() {
    if (!stack || !list) return;
    const items = Array.from(list.querySelectorAll('[data-like-user]')).slice(0, 5);
    stack.innerHTML = '';
    items.forEach((row) => {
      const username = row.dataset.likeUser;
      const sourceImg = row.querySelector('img');
      const span = document.createElement('span');
      span.className = 'liked-user-avatar little-avatar';
      span.title = username;
      const img = document.createElement('img');
      if (sourceImg?.classList.contains('avatar-load-failed')) {
        img.classList.add('avatar-load-failed');
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';
      } else {
        img.src = sourceImg?.getAttribute('src') || '/static/img/no_avatar.svg';
      }
      img.alt = username;
      img.className = 'user-avatar';
      img.width = 30;
      img.height = 30;
      img.decoding = 'async';
      img.loading = 'lazy';
      img.onerror = function () { this.onerror = null; this.classList.add('avatar-load-failed'); };
      span.appendChild(img);
      stack.appendChild(span);
    });
  }

  function updateButtonVisibility(likesCount) {
    const hasLikes = likesCount >= 1;
    if (noLikesYet) {
      noLikesYet.style.display = hasLikes ? 'none' : '';
    }
    if (likedUsersContainer) {
      likedUsersContainer.style.display = hasLikes ? '' : 'none';
    }
    if (!hasLikes && overlay && !overlay.classList.contains('hidden')) {
      closeOverlay();
    }
  }

  window.updateLikedUsersUI = function (data) {
    if (!current || !data) return;
    const username = current.dataset.username;
    const avatar = current.dataset.avatar;
    const profileUrl = current.dataset.profileUrl;
    if (!username) return;

    if (data.liked) {
      upsertListItem(username, avatar, profileUrl);
      syncStackFromList();
    } else {
      removeListItem(username);
      syncStackFromList();
    }
    if (typeof data.likes_count === 'number') {
      updateButtonVisibility(data.likes_count);
    }
    updateListMaxHeight();
  };
})();

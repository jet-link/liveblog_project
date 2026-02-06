(function () {
  'use strict';

  const btn = document.getElementById('likedUsersBtn');
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
    btn?.focus({ preventScroll: true });
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  btn?.addEventListener('click', (e) => {
    if (btn.disabled || btn.classList.contains('is-hidden')) return;
    e.preventDefault();
    openOverlay();
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
    img.onerror = function () { this.onerror = null; this.src = '/static/img/no_avatar.svg'; };
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
      const href = row.getAttribute('href') || '#';
      const sourceImg = row.querySelector('img');
      const link = document.createElement('a');
      link.href = href;
      link.className = 'liked-user-avatar little-avatar';
      link.title = username;
      const img = document.createElement('img');
      img.src = sourceImg?.getAttribute('src') || '/static/img/no_avatar.svg';
      img.alt = username;
      img.className = sourceImg?.className || 'user-avatar';
      img.width = 30;
      img.height = 30;
      img.decoding = 'async';
      img.loading = 'lazy';
      img.onerror = function () { this.onerror = null; this.src = '/static/img/no_avatar.svg'; };
      link.appendChild(img);
      stack.appendChild(link);
    });
  }

  function updateButtonVisibility(likesCount) {
    if (!btn) return;
    if (likesCount >= 1) {
      btn.classList.remove('is-hidden');
      btn.disabled = false;
    } else {
      btn.classList.add('is-hidden');
      btn.disabled = true;
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

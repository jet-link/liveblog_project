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
  const searchBtn = overlay?.querySelector('.users-search-btn');
  const searchInput = overlay?.querySelector('.liked-users-search-input');
  const emptyMsg = overlay?.querySelector('.liked-users-empty-msg');
  const current = document.getElementById('likedUsersCurrent');
  let initialOrder = [];
  if (!overlay) return;

  function captureInitialOrder() {
    if (!list) return;
    initialOrder = Array.from(list.querySelectorAll('.liked-users-item'));
  }

  function restoreInitialOrder() {
    if (!list || !initialOrder.length) return;
    initialOrder.forEach(function (item) {
      list.appendChild(item);
    });
  }

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
    const paddingBottom = 16;
    const target = Math.round(itemHeight * 10 + gap * 9) + paddingBottom;
    list.style.maxHeight = `${target}px`;
    list.style.overflowY = 'auto';
  }

  function openOverlay() {
    captureInitialOrder();
    filterLikedUsers(searchInput?.value || '');
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
    if (searchInput && searchInput.style.display !== 'none') {
      searchInput.style.display = 'none';
      searchInput.value = '';
      filterLikedUsers('');
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

  function showSearchInput() {
    if (!searchInput) return;
    searchInput.style.display = '';
    searchInput.focus();
  }

  function hideSearchInput() {
    if (!searchInput) return;
    searchInput.style.display = 'none';
    searchInput.value = '';
    filterLikedUsers('');
  }

  function filterLikedUsers(query) {
    if (!list) return;
    const q = (query || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const items = Array.from(list.querySelectorAll('.liked-users-item'));
    const partialMatches = [];
    const exactMatches = [];

    items.forEach(function (item) {
      const rawUsername = item.getAttribute('data-like-user') || '';
      const username = rawUsername.toLowerCase().trim().replace(/\s+/g, ' ');
      const badge = item.querySelector('.custom_badge');
      const rawLabel = badge ? badge.textContent : '';
      const label = rawLabel.trim().toLowerCase().replace(/\s+/g, ' ');
      const exact = q && (username === q || label === q);
      const partial = !q || username.indexOf(q) !== -1 || label.indexOf(q) !== -1;

      if (exact) exactMatches.push(item);
      if (partial) partialMatches.push(item);
    });

    var toShow = [];
    if (q) {
      toShow = exactMatches.length > 0 ? exactMatches : partialMatches;
    } else {
      restoreInitialOrder();
      toShow = items;
    }

    items.forEach(function (item) {
      item.style.setProperty('display', 'none', 'important');
    });
    toShow.forEach(function (item) {
      item.style.setProperty('display', 'flex', 'important');
    });

    if (q && toShow.length) {
      for (var i = toShow.length - 1; i >= 0; i--) {
        list.insertBefore(toShow[i], list.firstChild);
      }
    }

    var noMatches = q && toShow.length === 0;
    if (emptyMsg) {
      emptyMsg.style.display = noMatches ? 'flex' : 'none';
    }
    list.style.display = noMatches ? 'none' : 'flex';
  }

  searchBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    showSearchInput();
  });

  searchInput?.addEventListener('input', function () {
    filterLikedUsers(this.value);
  });

  searchInput?.addEventListener('focusout', function () {
    setTimeout(function () {
      if (!document.activeElement || !searchInput.contains(document.activeElement)) {
        hideSearchInput();
      }
    }, 120);
  });

  overlay?.addEventListener('click', function (e) {
    if (searchInput && searchInput.style.display !== 'none' &&
        !searchInput.contains(e.target) && !searchBtn?.contains(e.target)) {
      hideSearchInput();
    }
  });

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
    row.setAttribute('data-like-user', username);
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
    initialOrder.unshift(row);
  }

  function removeListItem(username) {
    if (!list) return;
    const existing = list.querySelector(`[data-like-user="${username}"]`);
    if (existing) {
      existing.remove();
      initialOrder = initialOrder.filter(function (item) { return item !== existing; });
    }
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

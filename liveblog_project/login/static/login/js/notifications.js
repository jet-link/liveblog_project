(function () {
  'use strict';

  function getCSRF() {
    return (document.cookie.split('; ').find(c => c.startsWith('csrftoken=')) || '').split('=')[1] || '';
  }

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRF(),
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(body || {}).toString()
    });
  }

  function sendReadToServer(id) {
    if (!id) return;
    const body = new URLSearchParams({
      notification_id: id,
      csrfmiddlewaretoken: getCSRF()
    }).toString();
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/x-www-form-urlencoded' });
      navigator.sendBeacon('/profile/notifications/read/', blob);
      return;
    }
    fetch('/profile/notifications/read/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRF(),
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      keepalive: true
    }).catch(() => {});
  }

  const list = document.querySelector('.notifications-list');
  const readAllBtn = document.getElementById('notificationsReadAll');
  const deleteBtn = document.getElementById('notificationsDelete');
  const deleteAllBtn = document.getElementById('notificationsDeleteAll');
  const deleteLast5Btn = document.getElementById('notificationsDeleteLast5');
  const deleteModalEl = document.getElementById('notificationsDeleteModal');
  const stateEl = document.getElementById('notificationsState');
  const actions = document.getElementById('notificationsActions');
  const emptyState = document.getElementById('notificationsEmpty');
  const legend = document.getElementById('notificationsLegend');
  const legendToggleBtn = document.querySelector('.notification-dropdown-info-btn');
  let unreadCount = parseInt(stateEl?.dataset?.unread || '0', 10);

  function renderReadBadge(container) {
    const badge = document.createElement('span');
    badge.className = 'notifications-done';
    badge.setAttribute('aria-label', 'Read');
    const icon = document.createElement('i');
    icon.className = 'fa fa-check';
    badge.appendChild(icon);
    container.replaceWith(badge);
  }

  function updateHeaderCount(count) {
    let badge = document.querySelector('.notifications-count');
    if (count <= 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      const btn = document.querySelector('.notification-btn');
      if (!btn) return;
      badge = document.createElement('span');
      badge.className = 'notifications-count custom_badge badge_danger';
      btn.insertBefore(badge, btn.querySelector('i'));
    }
    badge.textContent = count >= 10 ? '10+' : String(count);
  }

  function updateReadAllButton() {
    if (!readAllBtn) return;
    if (unreadCount <= 0) {
      readAllBtn.remove();
    }
  }

  function syncUnreadCount() {
    unreadCount = document.querySelectorAll('.notification-row[data-is-read="0"]').length;
    updateHeaderCount(unreadCount);
    updateReadAllButton();
    try {
      localStorage.setItem('notification_unread_count', String(unreadCount));
      localStorage.setItem('notification_count_updated_at', String(Date.now()));
      if (typeof window.updateBellCountFromStorage === 'function') {
        window.updateBellCountFromStorage();
      }
    } catch (err) {}
  }

  function hideActionsIfEmpty() {
    if (!actions) return;
    const remaining = document.querySelectorAll('.notification-row').length;
    if (remaining === 0) {
      actions.classList.add('d-none');
      if (emptyState) emptyState.classList.remove('d-none');
      const wrapper = document.getElementById('showMoreWrapper');
      if (wrapper) wrapper.classList.add('d-none');
      if (legend) legend.classList.add('d-none');
      if (legendToggleBtn) legendToggleBtn.classList.add('d-none');
    }
  }

  function initLegendDropdown() {
    if (!legend || !legendToggleBtn) {
      if (legendToggleBtn) legendToggleBtn.classList.add('d-none');
      return;
    }
    legend.classList.remove('is-open');
    legendToggleBtn.classList.remove('is-open');
    legendToggleBtn.setAttribute('aria-expanded', 'false');

    legendToggleBtn.addEventListener('click', () => {
      const isOpen = legend.classList.toggle('is-open');
      legendToggleBtn.classList.toggle('is-open', isOpen);
      legendToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  function markSeen(id, syncServer = false) {
    if (!id) return;
    try {
      localStorage.setItem(`notification_seen_${id}`, '1');
    } catch (err) {}
    if (syncServer) {
      sendReadToServer(id);
    }
    const row = document.querySelector(`.notification-row[data-notification-id="${id}"]`);
    if (row) {
      const wasUnread = row.dataset.isRead !== '1';
      row.classList.add('is-seen');
      row.dataset.isRead = '1';
      row.classList.add('is-read');
      const btn = row.querySelector('.notification-read-btn');
      if (btn) renderReadBadge(btn);
      if (wasUnread) syncUnreadCount();
    }
  }

  function initSeenMarkers() {
    const rows = document.querySelectorAll('.notification-row');
    rows.forEach(row => {
      const id = row.dataset.notificationId;
      if (!id) return;
      let seen = false;
      try {
        seen = localStorage.getItem(`notification_seen_${id}`) === '1';
      } catch (err) {}
      if (seen || row.dataset.isRead === '1') {
        row.classList.add('is-seen');
        row.dataset.isRead = '1';
        row.classList.add('is-read');
        const btn = row.querySelector('.notification-read-btn');
        if (btn) renderReadBadge(btn);
        try {
          localStorage.setItem(`notification_seen_${id}`, '1');
        } catch (err) {}
      }
    });

    document.querySelectorAll('.notification-target-link').forEach(link => {
      if (link.dataset.seenInit) return;
      link.dataset.seenInit = '1';
      link.addEventListener('click', () => {
        const id = link.dataset.notificationId;
        markSeen(id, true);
      });
    });
  }

  function initInstantLinkMarking() {
    document.addEventListener('pointerdown', (e) => {
      const link = e.target.closest?.('a.notification-target-link');
      if (!link) return;
      if (e.button !== undefined && e.button !== 0) return;
      const id = link.dataset.notificationId;
      if (id) markSeen(id, true);
    }, true);
  }

  function updateShowMore() {
    const btn = document.getElementById('showMoreBtn');
    const rows = Array.from(document.querySelectorAll('.notification-row'));
    if (!btn || !rows.length) return;
    const STEP = 50;
    let shown = Math.min(STEP, rows.length);

    function render() {
      rows.forEach((row, idx) => {
        if (idx < shown) {
          row.classList.remove('listing-hidden');
        } else {
          row.classList.add('listing-hidden');
        }
      });
      if (shown >= rows.length) btn.style.display = 'none';
    }

    render();
    btn.addEventListener('click', () => {
      shown = Math.min(shown + STEP, rows.length);
      render();
    });
  }

  list?.addEventListener('click', (e) => {
    const btn = e.target.closest('.notification-read-btn');
    if (!btn) return;
    const row = btn.closest('.notification-row');
    const id = row?.dataset?.notificationId;
    if (!id) return;

    btn.disabled = true;
    markSeen(id, true);
    hideActionsIfEmpty();
    btn.disabled = false;
  });

  readAllBtn?.addEventListener('click', async () => {
    readAllBtn.disabled = true;
    try {
      const resp = await post('/profile/notifications/read-all/');
      if (!resp.ok) return;
      document.querySelectorAll('.notification-row').forEach(el => {
        el.dataset.isRead = '1';
        el.classList.add('is-read');
        const btn = el.querySelector('.notification-read-btn');
        if (btn) {
          renderReadBadge(btn);
        }
        const id = el.dataset.notificationId;
        if (id) markSeen(id);
      });
      syncUnreadCount();
    } finally {
      readAllBtn.disabled = false;
    }
  });

  deleteBtn?.addEventListener('click', () => {
    const modal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
    modal.show();
  });

  deleteAllBtn?.addEventListener('click', async () => {
    deleteAllBtn.disabled = true;
    try {
      const resp = await post('/profile/notifications/delete/', { mode: 'all' });
      if (!resp.ok) return;
      document.querySelectorAll('.notification-row').forEach(el => el.remove());
      bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
      unreadCount = 0;
      updateHeaderCount(unreadCount);
      try {
        localStorage.setItem('notification_unread_count', '0');
        localStorage.setItem('notification_count_updated_at', String(Date.now()));
        if (typeof window.updateBellCountFromStorage === 'function') {
          window.updateBellCountFromStorage();
        }
      } catch (err) {}
      hideActionsIfEmpty();
    } finally {
      deleteAllBtn.disabled = false;
    }
  });

  deleteLast5Btn?.addEventListener('click', async () => {
    deleteLast5Btn.disabled = true;
    try {
      const resp = await post('/profile/notifications/delete/', { mode: 'last5' });
      if (!resp.ok) return;
      const rows = document.querySelectorAll('.notification-row');
      rows.forEach((el, idx) => {
        if (idx < 5) {
          el.remove();
        }
      });
      syncUnreadCount();
      bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
      hideActionsIfEmpty();
    } finally {
      deleteLast5Btn.disabled = false;
    }
  });

  updateShowMore();
  initLegendDropdown();
  initInstantLinkMarking();
  initSeenMarkers();
  syncUnreadCount();
  window.addEventListener('pageshow', () => {
    initSeenMarkers();
    syncUnreadCount();
  });
})();

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

  const list = document.querySelector('.notifications-list');
  const readAllBtn = document.getElementById('notificationsReadAll');
  const deleteBtn = document.getElementById('notificationsDelete');
  const deleteAllBtn = document.getElementById('notificationsDeleteAll');
  const deleteLast5Btn = document.getElementById('notificationsDeleteLast5');
  const deleteModalEl = document.getElementById('notificationsDeleteModal');
  const stateEl = document.getElementById('notificationsState');
  const readAllDone = document.getElementById('notificationsReadAllDone');
  const actions = document.getElementById('notificationsActions');
  const emptyState = document.getElementById('notificationsEmpty');
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
      const done = document.createElement('span');
      done.id = 'notificationsReadAllDone';
      done.className = 'notifications-done notifications-fade';
      done.setAttribute('aria-label', 'All read');
      const icon = document.createElement('i');
      icon.className = 'fa fa-check';
      done.appendChild(icon);
      readAllBtn.replaceWith(done);
      setTimeout(() => {
        done.classList.add('is-hidden');
        setTimeout(() => done.remove(), 300);
      }, 1200);
    }
  }

  function hideActionsIfEmpty() {
    if (!actions) return;
    const remaining = document.querySelectorAll('.notification-row').length;
    if (remaining === 0) {
      actions.classList.add('d-none');
      if (emptyState) emptyState.classList.remove('d-none');
      const wrapper = document.getElementById('showMoreWrapper');
      if (wrapper) wrapper.classList.add('d-none');
    }
  }

  function updateShowMore() {
    const btn = document.getElementById('showMoreBtn');
    const rows = Array.from(document.querySelectorAll('.notification-row'));
    if (!btn || !rows.length) return;
    const STEP = 10;
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

  list?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.notification-read-btn');
    if (!btn) return;
    const row = btn.closest('.notification-row');
    const id = row?.dataset?.notificationId;
    if (!id) return;

    btn.disabled = true;
    try {
      const resp = await post('/blog/notifications/read/', { notification_id: id });
      if (!resp.ok) return;
      row.dataset.isRead = '1';
      row.classList.add('is-read');
      unreadCount = Math.max(0, unreadCount - 1);
      updateHeaderCount(unreadCount);
      updateReadAllButton();
      renderReadBadge(btn);
      hideActionsIfEmpty();
    } finally {
      btn.disabled = false;
    }
  });

  readAllBtn?.addEventListener('click', async () => {
    readAllBtn.disabled = true;
    try {
      const resp = await post('/blog/notifications/read-all/');
      if (!resp.ok) return;
      document.querySelectorAll('.notification-row').forEach(el => {
        el.dataset.isRead = '1';
        el.classList.add('is-read');
        const btn = el.querySelector('.notification-read-btn');
        if (btn) {
          renderReadBadge(btn);
        }
      });
      unreadCount = 0;
      updateHeaderCount(unreadCount);
      updateReadAllButton();
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
      const resp = await post('/blog/notifications/delete/', { mode: 'all' });
      if (!resp.ok) return;
      document.querySelectorAll('.notification-row').forEach(el => el.remove());
      bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
      unreadCount = 0;
      updateHeaderCount(unreadCount);
      hideActionsIfEmpty();
    } finally {
      deleteAllBtn.disabled = false;
    }
  });

  deleteLast5Btn?.addEventListener('click', async () => {
    deleteLast5Btn.disabled = true;
    try {
      const resp = await post('/blog/notifications/delete/', { mode: 'last5' });
      if (!resp.ok) return;
      const rows = document.querySelectorAll('.notification-row');
      rows.forEach((el, idx) => {
        if (idx < 5) {
          if (el.dataset.isRead !== '1') {
            unreadCount = Math.max(0, unreadCount - 1);
          }
          el.remove();
        }
      });
      updateHeaderCount(unreadCount);
      bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
      hideActionsIfEmpty();
    } finally {
      deleteLast5Btn.disabled = false;
    }
  });

  updateShowMore();
})();

// static/js/comments.js
// Handles: AJAX add comment + AJAX delete comment (Bootstrap Modal)
// Requirements:
// - bootstrap.bundle.js
// - form#commentForm, button#submitCommentBtn
// - div#commentsList, span#commentsCount
// - div#commentsHeader (для изменения заголовка)
// - modal#confirmDeleteModal, button#confirmDeleteBtn
// - <body data-item-slug="...">

(function () {
  'use strict';


  // -------------------------------
  // Helper: получить CSRF из cookie
  // -------------------------------
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let c of cookies) {
        c = c.trim();
        if (c.startsWith(name + '=')) {
          cookieValue = decodeURIComponent(c.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  // Глобальный CSRF один раз
  if (typeof window.__COMMENTS_CSRF__ === 'undefined') {
    window.__COMMENTS_CSRF__ = getCookie('csrftoken') || null;
  }
  const CSRF = window.__COMMENTS_CSRF__;

  // безопасный JSON
  async function parseJsonSafe(resp) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  // -------------------------------
  // Блокировка кнопки (таймер)
  // -------------------------------
  function blockButtonCountdown(btn, seconds, storageKey) {
    if (!btn) return;

    const original = btn.textContent || btn.value || 'Comment';
    const endAt = Date.now() + seconds * 1000;

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, String(endAt));
      } catch { }
    }

    function tick() {
      const now = Date.now();
      const remaining = Math.ceil(
        (parseInt(localStorage.getItem(storageKey) || endAt) - now) / 1000
      );

      if (remaining <= 0) {
        btn.disabled = false;
        btn.textContent = original;
        try {
          localStorage.removeItem(storageKey);
        } catch { }
        clearInterval(intervalId);
        return;
      }

      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, '0');
      btn.textContent = `Please wait ${m}:${s}`;
      btn.disabled = true;
    }

    tick();
    const intervalId = setInterval(tick, 1000);
  }

  function restoreBlockingFromStorage(btn, storageKey) {
    if (!btn || !storageKey) return;
    const endAtStr = localStorage.getItem(storageKey);
    if (!endAtStr) return;

    const remaining = Math.ceil((parseInt(endAtStr) - Date.now()) / 1000);
    if (remaining > 0) {
      blockButtonCountdown(btn, remaining, storageKey);
    } else {
      localStorage.removeItem(storageKey);
    }
  }

  // helper: рендерит ошибки формы в контейнер (или под полями)
  // container — HTMLElement, messages может быть строкой, массивом или объектом { field: [msgs] }
  function renderFormErrors(container, messages) {
    if (!container) return;
    container.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'alert alert-info alert-dismissible fade show';
    box.setAttribute('role', 'alert');

    // Кнопка закрытия
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('data-bs-dismiss', 'alert');
    closeBtn.setAttribute('aria-label', 'Close');

    // Текст ошибки
    if (typeof messages === 'string') {
      box.innerHTML = messages;
    } else if (Array.isArray(messages)) {
      box.innerHTML = messages.join('<br>');
    } else if (typeof messages === 'object') {
      let txt = '';
      for (const [key, arr] of Object.entries(messages)) {
        txt += arr.join('<br>');
      }
      box.innerHTML = txt;
    }

    box.appendChild(closeBtn);
    container.appendChild(box);
  }

  // ----------------------------
  //   AJAX: добавление комментария
  // ----------------------------
  function initAddComment() {
    const form = document.getElementById('commentForm');
    if (!form) return;

    // avoid double-binding if script accidentally runs twice
    if (form.__ajaxBound) return;
    form.__ajaxBound = true;

    const btn = document.getElementById('submitCommentBtn');
    const commentsList = document.getElementById('commentsList');
    const commentsCount = document.getElementById('commentsCount');
    const commentsHeader = document.getElementById('commentsHeader');
    const errorsContainer = document.getElementById('commentFormErrors') || document.createElement('div');

    // ensure there's a place to show errors if not present
    if (!document.getElementById('commentFormErrors')) {
      errorsContainer.id = 'commentFormErrors';
      form.insertBefore(errorsContainer, form.firstChild);
    }

    const storageKey = 'comment_block_' + (document.body.dataset.itemSlug || 'default');

    // restore existing block (if user reloads)
    restoreBlockingFromStorage(btn, storageKey);

    btn.addEventListener('click', async function (e) {
      e.preventDefault();

      // client-side validation: check textarea
      const ta = form.querySelector('textarea[name="text"], textarea');
      const text = ta ? ta.value.trim() : '';

      if (!text) {
        renderFormErrors(errorsContainer, ['Please write comment.']);
        if (ta) ta.focus();
        return;
      } else {
        // remove old errors
        errorsContainer.innerHTML = '';
      }

      if (!CSRF) {
        // CSRF missing — do not attempt
        renderFormErrors(errorsContainer, ['CSRF token missing. Reload page.']);
        return;
      }

      // prevent double clicks while request in-flight
      if (btn.disabled) return;
      btn.disabled = true;

      let resp = null, data = null;
      try {
        resp = await fetch(form.action, {
          method: 'POST',
          headers: {
            'X-CSRFToken': CSRF,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json'
          },
          body: new FormData(form)
        });

        data = await parseJsonSafe(resp);
      } catch (err) {
        // network or other fetch error
        renderFormErrors(errorsContainer, ['Network error. Try again.']);
        console.error('fetch error', err);
        btn.disabled = false;
        return;
      }

      // ---------- SUCCESS ----------
      if (resp.ok && data && data.success) {
        if (commentsList && data.comment_html) {
          commentsList.insertAdjacentHTML('afterbegin', data.comment_html);
        }

        if (ta) ta.value = '';

        if (commentsCount && data.total_comments !== undefined) {
          commentsCount.textContent = data.total_comments;
        }

        // update header immediately
        if (commentsHeader && data.total_comments !== undefined) {
          if (Number(data.total_comments) > 0) {
            commentsHeader.innerHTML = `<h5 class="my-3 text-muted">Comments...</h5>`;
          } else {
            commentsHeader.innerHTML = `<h5 class="mt-3 text-muted">There are not comments here.</h5>`;
          }
        }

        // block button for 60s after success (persisted)
        blockButtonCountdown(btn, 60, storageKey);
        return;
      }

      // ---------- RATE LIMIT ----------
      if (resp && resp.status === 429) {
        const secs = Number(data && data.retry_after ? data.retry_after : 60);
        // show server message if provided
        if (data && data.error) renderFormErrors(errorsContainer, [data.error]);
        blockButtonCountdown(btn, secs, storageKey);
        return;
      }

      // ---------- VALIDATION ERRORS (400) ----------
      if (resp && resp.status === 400) {
        // server may return {"success": False, "error": "..."} OR {"success": False, "errors": {...}}
        if (data) {
          if (data.error) {
            renderFormErrors(errorsContainer, [data.error]);
          } else if (data.errors || data.non_field_errors || data.text) {
            // support several shapes
            if (data.errors || data.non_field_errors) {
              renderFormErrors(errorsContainer, { errors: data.errors || {}, non_field_errors: data.non_field_errors || [] });
            } else {
              // fallback: form.errors dict maybe in root
              renderFormErrors(errorsContainer, data);
            }
          } else {
            renderFormErrors(errorsContainer, ['Bad request']);
          }
        } else {
          renderFormErrors(errorsContainer, ['Bad request (no details)']);
        }
        btn.disabled = false;
        return;
      }

      // ---------- OTHER ERRORS ----------
      renderFormErrors(errorsContainer, [(data && data.error) ? data.error : 'Server error. Try again.']);
      btn.disabled = false;
    });

    // optional: show clear icon behavior (if you use clearTextIcon)
    const textArea = form.querySelector('textarea');
    const clearIcon = document.getElementById('clearTextIcon');
    if (textArea && clearIcon) {
      function updateClearIcon() {
        clearIcon.style.display = textArea.value.trim().length > 0 ? 'block' : 'none';
      }
      textArea.addEventListener('input', updateClearIcon);
      clearIcon.addEventListener('click', () => { textArea.value = ''; updateClearIcon(); textArea.focus(); });
      updateClearIcon();
    }
  }

  // ----------------------------
  //   AJAX: удаление комментария
  // ----------------------------
  function initDeleteComments() {
    const modalEl = document.getElementById('confirmDeleteModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const commentsHeader = document.getElementById('commentsHeader');

    if (!modalEl || !confirmBtn) return;

    // выбираем ID комментария по делегированию
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete-comment');
      if (!btn) return;

      confirmBtn.dataset.deleteUrl = btn.dataset.deleteUrl;
      confirmBtn.dataset.commentId = btn.dataset.commentId;
    });

    confirmBtn.addEventListener('click', async () => {
      const deleteUrl = confirmBtn.dataset.deleteUrl;
      const commentId = confirmBtn.dataset.commentId;
      if (!deleteUrl) return;

      confirmBtn.disabled = true;

      let resp, data;
      try {
        resp = await fetch(deleteUrl, {
          method: 'POST',
          headers: {
            'X-CSRFToken': CSRF,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json'
          }
        });

        data = await parseJsonSafe(resp);
      } catch {
        confirmBtn.disabled = false;
        // alert('Network error');
        return;
      }

      confirmBtn.disabled = false;

      // ---- после успешного удаления (вместо/наряду с существующим кодом) ----
      if (resp.ok && data && data.success) {
        // удалить DOM-узел (у тебя уже есть)
        const node = document.getElementById('comment-' + (data.comment_id || commentId));
        if (node) node.remove();

        // Обновить счётчик
        const cNode = document.getElementById('commentsCount');
        if (cNode && typeof data.total_comments !== 'undefined') {
          cNode.textContent = data.total_comments;
        }

        // Обновить заголовок (commentsHeader) — важно!
        const commentsHeader = document.getElementById('commentsHeader');
        if (commentsHeader && typeof data.total_comments !== 'undefined') {
          if (Number(data.total_comments) > 0) {
            commentsHeader.innerHTML = `<h5 class="my-3 text-muted">Comments...</h5>`;
          } else {
            commentsHeader.innerHTML = `<h5 class="mt-3 text-muted">There are not comments here.</h5>`;
          }
        }

        // Если комментариев стало 0 — очистим список (чтобы не осталось пустых карточек)
        const commentsList = document.getElementById('commentsList');
        if (commentsList && Number(data.total_comments) === 0) {
          commentsList.innerHTML = '';
        }

        // Закрыть модал (если использовали)
        try {
          const bsModal = bootstrap.Modal.getInstance(modalEl);
          if (bsModal) bsModal.hide();
        } catch (err) { /* ignore */ }
      }


      // alert(data?.error || 'Error deleting comment');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAddComment();
    initDeleteComments();
  });
})();



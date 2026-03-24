// static/js/comments.js
(function () {
  'use strict';

  /* ===============================
     CSRF
  =============================== */
  function getCookie(name) {
    return document.cookie
      .split('; ')
      .find(c => c.startsWith(name + '='))
      ?.split('=')[1];
  }

  async function parseJsonSafeReply(resp) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  async function parseJsonSafe(resp) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  async function parseJsonSafe(resp) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  const CSRF = getCookie('csrftoken');

  async function parseJsonSafe(resp) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  /* ===============================
     LISTING COMMENTS SYNC
  =============================== */
  function updateListingComments(itemId, count) {
    if (!itemId) return;

    let changes = {};
    try {
      changes = JSON.parse(sessionStorage.getItem('listing_changes') || '{}');
    } catch {
      changes = {};
    }

    if (!changes[itemId]) changes[itemId] = {};
    changes[itemId].comments_count = count;

    sessionStorage.setItem('listing_changes', JSON.stringify(changes));
  }

  /* ===============================
     UI HELPERS
  =============================== */
  function humanCount(n) {
    n = Number(n);
    if (n < 1000) return String(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function updateDetailCounter(count) {
    const el = document.getElementById('commentsCount');
    if (el) el.textContent = humanCount(count);
  }

  function updateCardCounter(itemId, count) {
    const el = document.getElementById('comments-count-' + itemId);
    if (el) el.textContent = humanCount(count);
  }

  function updateCommentsHeader(count) {
    const header = document.getElementById('commentsHeader');
    if (!header) return;

    const n = Number(count);
    if (n > 0) {
      header.innerHTML = `
        <h5 class="m-0 text-muted ">Comments</h5>
        <div class="d-flex gap-2 align-items-center small">
          <span id="commentsCount">${humanCount(n)}</span>
          <i class="fa fa-comment stat-comment"></i>
        </div>
      `;
    } else {
      header.innerHTML = `<h5 class="m-0 text-muted">There are not comments yet</h5>`;
    }
  }

  function getThreadLinkCount(link) {
    if (!link) return 0;
    const fromData = parseInt(link.dataset.count || '0', 10);
    if (!Number.isNaN(fromData) && fromData >= 0) return fromData;
    const span = link.querySelector('.replies-count');
    if (!span) return 0;
    const txt = (span.textContent || '').replace(/[()\s]/g, '');
    const num = parseInt(txt, 10);
    return Number.isNaN(num) ? 0 : num;
  }

  function countDirectReplyBlocks(container) {
    if (!container) return 0;
    let count = 0;
    for (const child of container.children) {
      if (child.classList?.contains('comment-block')) count += 1;
    }
    return count;
  }
  window.countDirectReplyBlocks = countDirectReplyBlocks;

  function applyThreadLinkClasses(link) {
    if (!link) return;
    link.classList.remove('primary_');
    link.classList.add(
      'text-decoration-none',
      'small',
      'd-flex',
      'gap-2',
      'align-items-center',
      'success_',
    );
  }

  function formatRepliesCountLabel(count) {
    return count >= 10 ? '10+' : String(count);
  }

  function renderThreadLinkContents(link, count) {
    if (!link) return;
    link.textContent = '';
    const circle = document.createElement('span');
    circle.className = 'replies-circle';
    const label = document.createElement('span');
    label.textContent = 'View deep replies';
    const arrow = document.createElement('span');
    arrow.className = 'replies-arrow';
    arrow.textContent = '→';
    const badge = document.createElement('span');
    badge.className = 'replies-count';
    badge.textContent = formatRepliesCountLabel(count);
    link.append(circle, label, arrow, badge);
  }

  function buildThreadLink(parentId, threadUrl, count) {
    const link = document.createElement('a');
    link.id = `replies-thread-link-${parentId}`;
    link.href = threadUrl;
    link.dataset.count = String(count);
    applyThreadLinkClasses(link);
    renderThreadLinkContents(link, count);
    return link;
  }
  window.buildThreadLink = buildThreadLink;

  function getThreadContext() {
    const marker = document.getElementById('threadViewMarker');
    if (!marker) return null;
    return {
      parentId: marker.dataset.parentId,
      backUrl: marker.dataset.backUrl,
    };
  }
  window.getThreadContext = getThreadContext;

  function setThreadLinkCount(parentId, count) {
    const link = document.getElementById('replies-thread-link-' + parentId);
    if (!link) return;
    const next = Math.max(0, count || 0);
    if (next <= 0) {
      const wrap = link.parentElement;
      link.remove();
      if (wrap && wrap.classList.contains('mt-3') && !wrap.children.length) {
        wrap.remove();
      }
      return;
    }
    link.dataset.count = String(next);
    applyThreadLinkClasses(link);
    const badge = link.querySelector('.replies-count');
    if (!link.querySelector('.replies-circle') || !badge) {
      renderThreadLinkContents(link, next);
      return;
    }
    badge.textContent = formatRepliesCountLabel(next);
  }

  function adjustThreadLinkCount(parentId, delta) {
    const link = document.getElementById('replies-thread-link-' + parentId);
    if (!link) return;
    const next = getThreadLinkCount(link) + (delta || 0);
    setThreadLinkCount(parentId, next);
  }
  window.setThreadLinkCount = setThreadLinkCount;
  window.adjustThreadLinkCount = adjustThreadLinkCount;

  function showFieldError(textarea, message) {
    if (!textarea) return;

    const form = textarea.closest('form');
    if (!form) return;

    form.querySelector('.field-error')?.remove();

    if (!message) return;

    const err = document.createElement('div');
    err.className = 'field-error';
    err.textContent = message;

    (textarea.closest('.form-floating') || textarea).after(err);
    textarea.focus();
  }

  function clearFieldError(textarea) {
    textarea?.closest('form')?.querySelector('.field-error')?.remove();
  }

  function replaceCommentFormWithShadowBanMessage() {
    const formBody = document.getElementById('commentFormBody');
    const pt4 = formBody?.previousElementSibling;
    if (pt4 && formBody) {
      pt4.innerHTML = '<div class="d-inline-flex align-items-center custom-alert custom-alert-danger"><span class="small danger_" title="You have been shadow banned">You have been shadow banned. Improve your trust score to restore access.</span></div>';
      formBody.style.display = 'none';
    }
    if (window.closeAllReplyForms) window.closeAllReplyForms();
  }

  const COMMENT_MAX_CHARS = 500;

  function countCommentChars(value) {
    return String(value || '').replace(/\r?\n/g, '').length;
  }

  function enforceCommentLimit(textarea, errorContainer = null) {
    if (!textarea) return true;
    const count = countCommentChars(textarea.value);
    if (count <= COMMENT_MAX_CHARS) {
      if (errorContainer) errorContainer.textContent = '';
      else clearFieldError(textarea);
      return true;
    }
    const msg = 'Maximum 500 characters (line breaks are not counted).';
    if (errorContainer) {
      errorContainer.textContent = msg;
    } else {
      showFieldError(textarea, msg);
    }
    return false;
  }
  window.enforceCommentLimit = enforceCommentLimit;

  /* ===============================
     ADD COMMENT
  =============================== */
  const COMMENT_COOLDOWN_SEC = 30;
  const COMMENT_COOLDOWN_KEY_PREFIX = 'comment_cooldown_until_';

  /** Per-user + per-item; otherwise another account on same browser inherits the timer. */
  function commentCooldownStorageKey(itemId, userId) {
    if (!itemId || userId === undefined || userId === null || userId === '') return null;
    return `${COMMENT_COOLDOWN_KEY_PREFIX}${userId}_${itemId}`;
  }

  function getCooldownRemaining(itemId, userId) {
    const key = commentCooldownStorageKey(itemId, userId);
    if (!key) return 0;
    const until = Number(localStorage.getItem(key) || 0);
    const diff = Math.ceil((until - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }

  function updateCommentButtonCooldown(btn, itemId, userId) {
    if (!btn || !itemId) return;

    const remaining = getCooldownRemaining(itemId, userId);
    const originalText =
      btn.dataset.originalText || btn.textContent || 'Comment';

    if (!btn.dataset.originalText) {
      btn.dataset.originalText = originalText;
    }

    if (remaining > 0) {
      btn.disabled = true;
      btn.classList.add('is-blocked');
      btn.textContent = `Blocked ${remaining}s`;

      if (!btn.__cooldownTimer) {
        btn.__cooldownTimer = setInterval(() => {
          const left = getCooldownRemaining(itemId, userId);
          if (left <= 0) {
            clearInterval(btn.__cooldownTimer);
            btn.__cooldownTimer = null;
            const key = commentCooldownStorageKey(itemId, userId);
            if (key) localStorage.removeItem(key);
            btn.disabled = false;
            btn.classList.remove('is-blocked');
            btn.textContent = btn.dataset.originalText;
            const form = btn.closest('form');
            const textarea = form?.querySelector('textarea[name="text"]');
            clearFieldError(textarea);
            return;
          }
          btn.textContent = `Blocked ${left}s`;
        }, 1000);
      }
      return;
    }

    if (btn.__cooldownTimer) {
      clearInterval(btn.__cooldownTimer);
      btn.__cooldownTimer = null;
    }
    btn.disabled = false;
    btn.classList.remove('is-blocked');
    btn.textContent = btn.dataset.originalText || originalText;
    const form = btn.closest('form');
    const textarea = form?.querySelector('textarea[name="text"]');
    clearFieldError(textarea);
  }

  function startCommentCooldown(itemId, btn = null, seconds = COMMENT_COOLDOWN_SEC, userId = null) {
    if (!itemId) return;
    const key = commentCooldownStorageKey(itemId, userId);
    if (!key) return;
    const until = Date.now() + seconds * 1000;
    localStorage.setItem(key, String(until));
    const targetBtn = btn || document.getElementById('submitCommentBtn');
    updateCommentButtonCooldown(targetBtn, itemId, userId);
  }

  /* ===============================
     REPLY COOLDOWN (30s per comment ID)
  =============================== */
  const REPLY_COOLDOWN_SEC = 30;
  const REPLY_COOLDOWN_KEY_PREFIX = 'reply_cooldown_until_';

  function getReplyCooldownRemaining(commentId) {
    if (!commentId) return 0;
    const key = `${REPLY_COOLDOWN_KEY_PREFIX}${commentId}`;
    const until = Number(localStorage.getItem(key) || 0);
    const diff = Math.ceil((until - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }

  function updateReplyButtonCooldown(btn, commentId) {
    if (!btn || !commentId) return;
    const remaining = getReplyCooldownRemaining(commentId);
    const originalText = btn.dataset.originalReplyText || 'Reply';
    if (!btn.dataset.originalReplyText) btn.dataset.originalReplyText = originalText;

    if (remaining > 0) {
      btn.disabled = true;
      btn.classList.add('is-reply-blocked');
      btn.innerHTML = `<span class="reply-cooldown-timer">${remaining}s</span>`;
      if (!btn.__replyCooldownTimer) {
        btn.__replyCooldownTimer = setInterval(() => {
          const left = getReplyCooldownRemaining(commentId);
          if (left <= 0) {
            clearInterval(btn.__replyCooldownTimer);
            btn.__replyCooldownTimer = null;
            localStorage.removeItem(`${REPLY_COOLDOWN_KEY_PREFIX}${commentId}`);
            btn.disabled = false;
            btn.classList.remove('is-reply-blocked');
            btn.textContent = originalText;
            return;
          }
          const timerEl = btn.querySelector('.reply-cooldown-timer');
          if (timerEl) timerEl.textContent = left + 's';
        }, 1000);
      }
      return;
    }

    if (btn.__replyCooldownTimer) {
      clearInterval(btn.__replyCooldownTimer);
      btn.__replyCooldownTimer = null;
    }
    btn.disabled = false;
    btn.classList.remove('is-reply-blocked');
    btn.textContent = originalText;
  }

  function startReplyCooldown(commentId, seconds = REPLY_COOLDOWN_SEC) {
    if (!commentId) return;
    const until = Date.now() + seconds * 1000;
    localStorage.setItem(`${REPLY_COOLDOWN_KEY_PREFIX}${commentId}`, String(until));
    document.querySelectorAll(`.comment-menu-action[data-action="reply"][data-comment-id="${commentId}"]`).forEach(btn => {
      updateReplyButtonCooldown(btn, commentId);
    });
  }

  function initAllReplyButtonsCooldown() {
    document.querySelectorAll('.comment-menu-action[data-action="reply"]').forEach(btn => {
      const commentId = btn.dataset.commentId;
      if (commentId) updateReplyButtonCooldown(btn, commentId);
    });
  }

  function parseCooldownSeconds(message) {
    if (!message) return null;
    const match = String(message).match(/(\d+)\s*second/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    return Number.isNaN(n) ? null : n;
  }

  function initClearCommentButton(textarea, clearBtn) {
    if (!textarea || !clearBtn) return;

    const toggle = () => {
      if (textarea.value.trim().length > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    };

    // показываем / скрываем при вводе
    textarea.addEventListener('input', toggle);

    // очистка по клику
    clearBtn.addEventListener('click', () => {
      textarea.value = '';
      textarea.style.height = 'auto';
      clearFieldError(textarea);
      toggle();
      textarea.focus();
    });

    // начальное состояние
    toggle();
  }
  function initAddComment() {
    const form = document.getElementById('commentForm');
    if (!form || form.__bound) return;
    form.__bound = true;

    const formBody = document.getElementById('commentFormBody');
    const toggleBtn = document.querySelector('.comment-form-btn');
    const toggleDown = toggleBtn?.querySelector('.fa-angle-down');
    const toggleUp = toggleBtn?.querySelector('.fa-angle-up');
    const btn = document.getElementById('submitCommentBtn');
    const textarea = form.querySelector('textarea[name="text"]');
    const commentsList = document.getElementById('commentsList');
    const itemId = form.dataset.itemId;
    const userId = form.dataset.userId;
    const clearBtn = document.getElementById('clearComment');

    initClearCommentButton(textarea, clearBtn);
    updateCommentButtonCooldown(btn, itemId, userId);
    textarea.addEventListener('input', () => {
      if (textarea.value.trim()) {
        clearFieldError(textarea);
      }
      enforceCommentLimit(textarea);
    });

    if (toggleBtn && formBody) {
      toggleBtn.addEventListener('click', () => {
        formBody.classList.toggle('hidden');
        const isOpen = !formBody.classList.contains('hidden');
        if (toggleDown && toggleUp) {
          toggleDown.classList.toggle('hidden', isOpen);
          toggleUp.classList.toggle('hidden', !isOpen);
        }
        if (isOpen) {
          textarea?.focus();
        }
      });
    }

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      if (getCooldownRemaining(itemId, userId) > 0) {
        updateCommentButtonCooldown(btn, itemId, userId);
        return;
      }

      clearFieldError(textarea);
      if (!enforceCommentLimit(textarea)) return;
      const text = textarea.value.trim();
      if (!text) {
        showFieldError(textarea, 'Please write a text...');
        return;
      }

      btn.disabled = true;

      try {
        const resp = await fetch(form.action, {
          method: 'POST',
          headers: {
            'X-CSRFToken': CSRF,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
          },
          body: new FormData(form)
        });

        const data = await parseJsonSafe(resp);
        if (resp.ok && data?.success) {
          commentsList?.insertAdjacentHTML('afterbegin', data.comment_html);
          // apply long-text toggle to the new root comment immediately
          if (commentsList?.firstElementChild) {
            window.initCommentToggles?.(commentsList.firstElementChild);
          }
          window.refreshRootCommentsPagination?.();

          textarea.value = '';
          textarea.style.height = 'auto';

          // 🔥 ВАЖНО: скрываем кнопку Clear после отправки
          clearBtn?.classList.add('hidden');

          const count = data.comments_count;

          updateDetailCounter(count);
          updateCardCounter(itemId, count);
          updateListingComments(itemId, count);
          updateCommentsHeader(count);
          startCommentCooldown(itemId, btn, COMMENT_COOLDOWN_SEC, userId);

          return;
        }

        if (resp.status === 429) {
          const seconds = parseCooldownSeconds(data?.error);
          if (seconds) {
            startCommentCooldown(itemId, btn, seconds, userId);
          }
        }

        const errMsg = data?.error || 'Server error';
        showFieldError(textarea, errMsg);

        if (resp.status === 403) {
          replaceCommentFormWithShadowBanMessage();
        }

      } catch (err) {
        showFieldError(textarea, 'Unable to submit. Please try again.');
      } finally {
        updateCommentButtonCooldown(btn, itemId, userId);
      }
    });

    const trustStatusUrl = form.dataset.trustStatusUrl;
    if (trustStatusUrl) {
      const trustPollInterval = setInterval(async () => {
        try {
          const resp = await fetch(trustStatusUrl, {
            headers: { 'Accept': 'application/json' },
            credentials: 'same-origin'
          });
          if (!resp.ok) return;
          const data = await parseJsonSafe(resp);
          if (data?.shadow_banned) {
            clearInterval(trustPollInterval);
            replaceCommentFormWithShadowBanMessage();
          }
        } catch (e) { /* ignore */ }
      }, 25000);
    }

    // "Please write a text" исчезает только при вводе в поле, не при клике вне формы
  }


  /* ===============================
     DELETE COMMENT
  =============================== */
  function initDeleteComments() {
    const modal = document.getElementById('confirmDeleteModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (!modal || !confirmBtn) return;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete-comment');
      if (!btn) return;
 
      confirmBtn.dataset.deleteUrl = btn.dataset.deleteUrl;
      confirmBtn.dataset.itemId = modal.dataset.itemId; // КЛЮЧ
    });
    confirmBtn.addEventListener('click', async () => {
      const url = confirmBtn.dataset.deleteUrl;
      const itemId = confirmBtn.dataset.itemId;
      if (!url) return;

      confirmBtn.disabled = true;

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'X-CSRFToken': CSRF,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
          }
        });

        const data = await parseJsonSafe(resp);

        if (resp.ok && data?.success) {
          const deleted = document.getElementById('comment-' + data.comment_id);
          if (!deleted) return;

          const container = document.getElementById('commentsList');
          const isRootComment = container && deleted.parentElement === container;
          const threadContext = getThreadContext();
          const isThreadRoot = threadContext && String(data.comment_id) === String(threadContext.parentId);

          if (isThreadRoot) {
            try {
              sessionStorage.setItem('thread_back_anchor', 'replies-thread-link-' + threadContext.parentId);
              sessionStorage.setItem('thread_back_url', threadContext.backUrl || window.location.origin);
              sessionStorage.setItem('thread_remove_link_' + threadContext.parentId, '1');
              sessionStorage.setItem('thread_deleted_parent_' + threadContext.parentId, '1');
            } catch { }
            if (history.length > 1) {
              history.back();
            } else {
              window.location.href = threadContext.backUrl || '/';
            }
            return;
          }

          bootstrap.Modal.getInstance(modal)?.hide();

          function doCleanup() {
            if (data.parent_id) {
              const parentComment = document.getElementById('comment-' + data.parent_id);
              if (parentComment) {
                const replies = parentComment.querySelector('.replies');
                if (replies && countDirectReplyBlocks(replies) === 0) {
                  replies.remove();
                }
                const ctx = getThreadContext();
                if (!ctx) {
                  const depth = parseInt(parentComment.dataset.depth || '0', 10);
                  const link = document.getElementById('replies-thread-link-' + data.parent_id);
                  if (depth >= 2) {
                    if (!replies || countDirectReplyBlocks(replies) === 0) {
                      if (link) link.remove();
                    } else if (!link) {
                      const threadUrl = parentComment?.dataset?.threadUrl || `${window.location.origin}/blog/comment/${data.parent_id}/thread/`;
                      const replyCount = replies ? countDirectReplyBlocks(replies) : 1;
                      const wrap = document.createElement('div');
                      wrap.className = 'mt-4';
                      wrap.appendChild(buildThreadLink(data.parent_id, threadUrl, replyCount));
                      parentComment.appendChild(wrap);
                    } else {
                      window.adjustThreadLinkCount?.(data.parent_id, -1);
                    }
                  }
                }
              }
            }
            if (isRootComment) window.refreshRootCommentsPagination?.();
            if (threadContext) {
              const tid = threadContext.parentId;
              const threadRoot = document.getElementById('comment-' + tid);
              const threadReplies = threadRoot?.querySelector('.replies');
              const threadEmpty = document.getElementById('threadEmpty');
              const rc = countDirectReplyBlocks(threadReplies);
              try { sessionStorage.setItem('thread_replies_count_' + tid, String(rc)); } catch { }
              if (!threadReplies || countDirectReplyBlocks(threadReplies) === 0) {
                try { sessionStorage.setItem('thread_remove_link_' + tid, '1'); } catch { }
                if (threadEmpty) threadEmpty.classList.remove('d-none');
              } else if (threadEmpty) threadEmpty.classList.add('d-none');
            }
            const count = data.comments_count;
            updateDetailCounter(count);
            updateCardCounter(itemId, count);
            updateListingComments(itemId, count);
            updateCommentsHeader(count);
          }

          deleted.remove();
          doCleanup();
        }
        // closeAllReplyForms();


      } catch (err) {
        console.error('Delete comment failed:', err);
      } finally {
        confirmBtn.disabled = false;
      }
    });

  }

  /* ===============================
     INIT
  =============================== */
  function handleThreadBackScroll() {
    try {
      // always remove thread links marked for deletion
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key || !key.startsWith('thread_remove_link_')) continue;
        const parentId = key.replace('thread_remove_link_', '');
        const link = document.getElementById('replies-thread-link-' + parentId);
        if (link) link.remove();
        sessionStorage.removeItem(key);
      }

      // remove parent comments deleted in thread view
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key || !key.startsWith('thread_deleted_parent_')) continue;
        const parentId = key.replace('thread_deleted_parent_', '');
        const parentNode = document.getElementById('comment-' + parentId);
        if (parentNode) parentNode.remove();
        sessionStorage.removeItem(key);
      }

      // sync replies count for thread links after returning from thread view
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key || !key.startsWith('thread_replies_count_')) continue;
        const parentId = key.replace('thread_replies_count_', '');
        const count = parseInt(sessionStorage.getItem(key) || '0', 10);
        const parentComment = document.getElementById('comment-' + parentId);
        if (parentComment) {
          const depth = parseInt(parentComment.dataset.depth || '0', 10);
          if (depth >= 2) {
            if (count <= 0) {
              const link = document.getElementById('replies-thread-link-' + parentId);
              if (link) link.remove();
            } else {
              let link = document.getElementById('replies-thread-link-' + parentId);
              if (!link) {
                const threadUrl =
                  parentComment?.dataset?.threadUrl ||
                  `${window.location.origin}/blog/comment/${parentId}/thread/`;
                const wrap = document.createElement('div');
                wrap.className = 'mt-4';
                wrap.appendChild(buildThreadLink(parentId, threadUrl, count));
                parentComment.appendChild(wrap);
              } else {
                setThreadLinkCount(parentId, count);
              }
            }
          }
        }
        sessionStorage.removeItem(key);
      }

      sessionStorage.removeItem('thread_back_anchor');
      sessionStorage.removeItem('thread_back_url');
    } catch (e) { /* ignore */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAddComment();
    initDeleteComments();
    handleThreadBackScroll();
  });

  window.addEventListener('pageshow', () => {
    handleThreadBackScroll();
  });

  window.getReplyCooldownRemaining = getReplyCooldownRemaining;
  window.startReplyCooldown = startReplyCooldown;
  window.initAllReplyButtonsCooldown = initAllReplyButtonsCooldown;

})();




// static/js/comment_edit.js
(function () {
  'use strict';

  /* ===============================
     Helpers
  =============================== */

  function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  function getCookie(name) {
    return document.cookie
      .split('; ')
      .find(c => c.startsWith(name + '='))
      ?.split('=')[1];
  }

  const CSRF = getCookie('csrftoken');

  /* ===============================
     FIELD ERROR (как add / reply)
  =============================== */

  function showFieldError(textarea, message) {
    if (!textarea) return;

    const form = textarea.closest('form');
    if (!form) return;

    // удалить старую ошибку
    const old = form.querySelector('.field-error');
    if (old) old.remove();

    if (!message) return;

    const err = document.createElement('div');
    err.className = 'field-error';
    err.textContent = message;

    const wrap = textarea.closest('.form-floating') || textarea;
    wrap.after(err);

    textarea.focus();
  }

  function clearFieldError(textarea) {
    const form = textarea?.closest('form');
    const err = form?.querySelector('.field-error');
    if (err) err.remove();
  }

  /* ===============================
     OPEN EDITOR
  =============================== */

  function closeAllCommentEditForms() {
    document.querySelectorAll('.comment-edit-form .cancel-edit')
      .forEach(btn => btn.click());
  }

  window.closeAllCommentEditForms = closeAllCommentEditForms;

  function openEditor(commentNode, commentId, editUrl) {
    if (window.closeAllReplyForms) {
      window.closeAllReplyForms();
    }

    const body = commentNode.querySelector('.comment-body');
    if (!body) return;

    // не открывать второй раз
    if (commentNode.querySelector('.comment-edit-form')) return;

    const originalHtml = body.innerHTML;
    const textDiv = body.querySelector('.comment-text');
    const rawHtml = commentNode.dataset.rawHtml || '';
    const editText = commentNode.dataset.editText || '';

    const decodeHtml = (value) => {
      if (!value) return '';
      const temp = document.createElement('textarea');
      temp.innerHTML = value;
      return temp.value;
    };

    const displayHtml =
      textDiv?.dataset.fullHtml || textDiv?.innerHTML || '';
    const fullHtml =
      editText ? decodeHtml(editText) : (decodeHtml(rawHtml) || displayHtml);
    if (fullHtml && !commentNode.dataset.rawHtml && !editText) {
      commentNode.dataset.rawHtml = fullHtml;
    }
    // cache rendered html for restore after cancel
    if (displayHtml) {
      commentNode.dataset.fullHtmlCache = displayHtml;
    }

    let originalText = fullHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    let mention = null;

    // 🔥 надёжное извлечение mention
    const match = originalText.match(/^@([\w.-]+)\s*,?\s*/);
    if (match) {
      mention = match[1];
      originalText = originalText.replace(/^@[\w.-]+\s*,?\s*/, '');
    }

    /* ===============================
       FORM
    =============================== */

    const form = document.createElement('form');
    form.className = 'comment-edit-form';
    form.noValidate = true;

    const wrap = document.createElement('div');
    wrap.className = 'form-floating mb-2';

    const textarea = document.createElement('textarea');
    textarea.name = 'text';
    textarea.className = 'form-control';
    textarea.id = `comment-edit-text-${commentId}`;
    textarea.rows = 1;
    textarea.required = true;
    textarea.placeholder = 'Edited text';
    textarea.value = originalText;

    const mentionId = commentNode.dataset.mentionId || '';
    if (mention) {
      textarea.dataset.mention = mention;
    }
    if (mentionId) {
      textarea.dataset.mentionId = mentionId;
    }

    const label = document.createElement('label');
    label.textContent = 'Edited text';
    label.htmlFor = textarea.id;

    wrap.appendChild(textarea);
    wrap.appendChild(label);
    form.appendChild(wrap);

    const btnRow = document.createElement('div');
    btnRow.className = 'd-flex gap-1';

    const btnSave = document.createElement('button');
    btnSave.type = 'submit';
    btnSave.className = 'cstm-btn custom-primary-btn cstm-btn-sm';
    btnSave.textContent = 'Edit';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'cstm-btn custom-secondary-btn cstm-btn-sm';
    btnCancel.textContent = 'Cancel';
    btnCancel.classList.add('cancel-edit');

    btnRow.appendChild(btnSave);
    btnRow.appendChild(btnCancel);
    form.appendChild(btnRow);

    body.innerHTML = '';
    body.appendChild(form);

    textarea.focus();
    autoResizeTextarea(textarea);

    textarea.addEventListener('input', () => {
      autoResizeTextarea(textarea);
      clearFieldError(textarea);
    });

    btnCancel.addEventListener('click', () => {
      body.innerHTML = originalHtml;

      // сбросить toggle, чтобы Show more/less снова работал
      const textEl = commentNode.querySelector('.comment-text');
      if (textEl) {
        const cached = commentNode.dataset.fullHtmlCache || textEl.innerHTML;
        textEl.innerHTML = cached;
        textEl.dataset.fullHtml = cached;
        delete textEl.dataset.toggleInit;
      }
      commentNode.querySelectorAll('.comment-toggle-btn').forEach(btn => btn.remove());

      restoreCommentUI(commentNode);
    });

    /* ===============================
       SUBMIT
    =============================== */

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      clearFieldError(textarea);

      let text = textarea.value.trim();
      if (!text) {
        showFieldError(textarea, 'Please write a text...');
        return;
      }

      const mentionId = textarea.dataset.mentionId;
      const mention = textarea.dataset.mention;
      if (mentionId && mention) {
        text = text.replace(new RegExp('@' + mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), '@[user:' + mentionId + ']');
      } else if (mentionId && !mention) {
        text = `@[user:${mentionId}], ${text}`;
      } else if (mention) {
        text = `@${mention}, ${text}`;
      }

      btnSave.disabled = true;
      btnCancel.disabled = true;

      try {
        const trustStatusUrl = document.body.dataset.trustStatusUrl;
        if (trustStatusUrl) {
          try {
            const statusResp = await fetch(trustStatusUrl, {
              headers: { 'Accept': 'application/json' },
              credentials: 'same-origin'
            });
            if (statusResp.ok) {
              const statusData = await statusResp.json();
              if (statusData && statusData.shadow_banned) {
                showFieldError(textarea, 'You have been shadow banned. Improve your trust score to restore access.');
                return;
              }
            }
          } catch (e) { /* ignore */ }
        }

        const fd = new FormData();
        fd.append('text', text);

        const resp = await fetch(editUrl, {
          method: 'POST',
          headers: {
            'X-CSRFToken': CSRF,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json'
          },
          body: fd,
          credentials: 'same-origin'
        });

        const data = await resp.json().catch(() => null);
        if (resp.ok && data?.success) {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = data.comment_html;

          const newNode = wrapper.firstElementChild;
          commentNode.replaceWith(newNode);
          if (window.initCommentToggles) {
            restoreCommentUI(newNode);
          }
          if (window.initAutoDismiss) window.initAutoDismiss(newNode);
          initEditButtons();
          return;
        }

        showFieldError(
          textarea,
          data?.errors?.text?.[0] || data?.error || 'Server error'
        );

      } catch (err) {
        showFieldError(textarea, 'Unable to save. Please try again.');
      } finally {
        btnSave.disabled = false;
        btnCancel.disabled = false;
      }

    });
  }

  /* ===============================
     INIT
  =============================== */

  function delegatedClick(e) {
    const btn = e.target.closest('.btn-edit-comment');
    if (!btn) return;

    e.preventDefault();

    const commentId = btn.dataset.commentId;
    const editUrl = btn.dataset.editUrl;

    if (!commentId || !editUrl) return;

    const commentNode = document.getElementById('comment-' + commentId);
    if (!commentNode) return;

    openEditor(commentNode, commentId, editUrl);
  }

  function initEditButtons() {
    document.removeEventListener('click', delegatedClick);
    document.addEventListener('click', delegatedClick);
  }

  document.addEventListener('DOMContentLoaded', initEditButtons);
})();



// static/js/comment_like.js
(function () {
  'use strict';

  // get CSRF token — использую meta tag в base.html: <meta name="csrf-token" content="{{ csrf_token }}">
  function getCsrfToken() {
    // try meta tag first
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) return meta.getAttribute('content');
    // fallback to cookie (Django default name)
    const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
    return match ? match[2] : null;
  }

  function syncButtonState(btn) {
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    const icon = btn.querySelector('i');
    setIconState(icon, pressed);
  }

  // helper to toggle icon classes
  function setIconState(iconEl, liked) {
    if (!iconEl) return;

    iconEl.classList.toggle('fa-thumbs-up', liked);
    iconEl.classList.toggle('fa-thumbs-o-up', !liked);
  }

  function handleClick(ev) {
    const btn = ev.currentTarget;
    if (!btn) return;
    ev.preventDefault();

    // prevent double actions
    if (btn.dataset.processing === '1') return;
    btn.dataset.processing = '1';

    const url = btn.getAttribute('data-url');
    const commentId = btn.getAttribute('data-comment-id');

    if (!url || !commentId) {
      btn.dataset.processing = '0';
      return;
    }

    const csrf = getCsrfToken();

    // send POST
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf || '',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({}) // body not needed but keep JSON in case you expand
    }).then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    }).then(data => {
      if (!data || !data.success) throw new Error('Invalid response');

      const liked = !!data.liked;
      const likesCount = data.likes_count;

      // 🔥 обновляем aria-pressed
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');

      const icon = document.getElementById('comment-like-icon-' + data.comment_id);
      const countNode = document.getElementById('comment-likes-count-' + data.comment_id);

      if (icon) {
        icon.classList.add('btn-bounce');
        setIconState(icon, liked);
        icon.addEventListener('animationend', function _onEnd() {
          icon.classList.remove('btn-bounce');
          icon.removeEventListener('animationend', _onEnd);
        });
      }

      if (countNode && typeof likesCount !== 'undefined') {
        countNode.textContent = likesCount;
      }
    }).catch(err => {
      console.error('Comment like error:', err);
      // optionally show a UI message
    }).finally(() => {
      // small delay to avoid extremely rapid re-clicks
      setTimeout(function () { btn.dataset.processing = '0'; }, 250);
    });

  }

  function init() {
    const buttons = Array.from(
      document.querySelectorAll('.btn-comment-like')
    );

    buttons.forEach(btn => {
      syncButtonState(btn);
      btn.removeEventListener('click', handleClick);
      btn.addEventListener('click', handleClick, { passive: false });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();



// ---------- Bootstrap tooltips re-init helper (FIXED) ----------
(function () {
  function initTooltips(root = document) {
    if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;

    const elements = root.querySelectorAll('[data-bs-toggle="tooltip"]');

    elements.forEach(el => {
      // 💥 ВАЖНО: если tooltip уже был — уничтожаем
      const instance = bootstrap.Tooltip.getInstance(el);
      if (instance) {
        instance.dispose();
      }

      // создаём заново
      new bootstrap.Tooltip(el);
    });
  }

  window.initTooltips = initTooltips;

  document.addEventListener('DOMContentLoaded', () => {
    initTooltips();
  });
})();




// to top comments list
(function () {
  const btn = document.getElementById('commentsBackToTop');
  const commentsHeader = document.getElementById('commentsHeader');
  const commentsList = document.getElementById('commentsList');

  if (!btn || !commentsHeader || !commentsList) return;

  // сколько пикселей = 1–2 комментария
  const SHOW_AFTER_PX = 200;

  function checkVisibility() {
    const rect = commentsList.getBoundingClientRect();

    // если список ушёл вверх экрана
    if (rect.top < -SHOW_AFTER_PX) {
      btn.classList.add('is-visible');
    } else {
      btn.classList.remove('is-visible');
    }
  }

  window.addEventListener('scroll', checkVisibility, { passive: true });

  btn.addEventListener('click', () => {
    commentsList.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  });
})();



// autosize_textarea.js
(function () {
  function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  function initAutosize() {
    const textareas = document.querySelectorAll('textarea.auto-grow');

    textareas.forEach(textarea => {
      autoResize(textarea);

      textarea.addEventListener('input', () => {
        autoResize(textarea);
      });
    });
  }


  // при обычной загрузке
  document.addEventListener('DOMContentLoaded', initAutosize);

  // если textarea появляется динамически (редактирование комментария)
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('auto-grow')) {
      autoResize(e.target);
    }
  });
})();



// static/js/reply_comment.js
(function () {
  'use strict';

  const getThreadContext = window.getThreadContext || function () {
    const marker = document.getElementById('threadViewMarker');
    if (!marker) return null;
    return {
      parentId: marker.dataset.parentId,
      backUrl: marker.dataset.backUrl,
    };
  };

  function getCookie(name) {
    return document.cookie
      .split('; ')
      .find(c => c.startsWith(name + '='))
      ?.split('=')[1];
  }

  async function parseJsonSafeReply(resp) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  function closeAllReplyForms() {
    document.querySelectorAll('.reply-form').forEach(form => {
      form.classList.add('d-none');

      const textarea = form.querySelector('textarea[name="text"]');
      if (textarea) {
        textarea.value = '';
        textarea.style.height = 'auto';
        delete textarea.dataset.mentionId;
      }

      const errors = form.querySelector('.reply-form-errors');
      if (errors) {
        errors.textContent = '';
      }
    });

    document
      .querySelectorAll('.comment-active')
      .forEach(el => el.classList.remove('comment-active'));
  }
  window.closeAllReplyForms = closeAllReplyForms;

  function closeAllCommentEditForms() {
    document.querySelectorAll('.comment-edit-form .cancel-edit')
      .forEach(btn => btn.click());
  }
  window.closeAllCommentEditForms = closeAllCommentEditForms;

  function openReplyForm(commentId, mentionId) {
    const container = document.getElementById(`reply-form-${commentId}`);
    if (!container) return;

    if (window.getReplyCooldownRemaining?.(commentId) > 0) return;

    if (window.closeAllCommentEditForms) {
      window.closeAllCommentEditForms();
    }
    closeAllReplyForms();
    container.classList.remove('d-none');

    const textarea = container.querySelector('textarea[name="text"]');
    if (!textarea) return;

    textarea.value = '';
    textarea.dataset.mentionId = mentionId;
    textarea.focus();

    document.getElementById(`comment-${commentId}`)
      ?.classList.add('comment-active');
  }

  function closeAllCommentMenus() {
    document.querySelectorAll('.comment-menu.open')
      .forEach(menu => {
        menu.classList.remove('open');
      });
  }

  /* ===============================
     CLOSE FORMS ON OUTSIDE CLICK
  =============================== */
  document.addEventListener('click', (e) => {
    const clickedReplyForm = e.target.closest?.('.reply-form');
    const clickedEditForm = e.target.closest?.('.comment-edit-form');
    const replyTrigger = e.target.closest?.('.btn-reply, .comment-menu-action[data-action="reply"]');
    const editTrigger = e.target.closest?.('.btn-edit-comment');

    if (!clickedReplyForm && !replyTrigger) {
      closeAllReplyForms();
    }
    if (!clickedEditForm && !editTrigger) {
      closeAllCommentEditForms();
    }
  });

  function buildCommentShareUrl(commentId) {
    const base = window.location.href.split('#')[0];
    return `${base}#comment-anchor-${commentId}`;
  }

  function ensureShareOverlay() {
    let overlay = document.getElementById('commentShareOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'commentShareOverlay';
    overlay.className = 'comment-share-overlay';
    overlay.innerHTML = '<div class="comment-share-overlay-text">Comment link copied to clipboard</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function showShareOverlay() {
    const overlay = ensureShareOverlay();
    overlay.classList.add('is-visible');
    if (overlay.__timer) {
      clearTimeout(overlay.__timer);
    }
    overlay.__timer = setTimeout(() => {
      overlay.classList.remove('is-visible');
    }, 1400);
  }

  async function shareCommentUrl(url) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        showShareOverlay();
        return;
      } catch { }
    }

    const temp = document.createElement('textarea');
    temp.value = url;
    temp.setAttribute('readonly', 'true');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
    showShareOverlay();
  }

  /* ===============================
     SHOW REPLY FORM
  =============================== */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-reply');
    if (!btn) return;

    e.preventDefault();

    const commentId = btn.dataset.commentId;
    const mentionId = btn.dataset.mentionId;
    if (window.getReplyCooldownRemaining?.(commentId) > 0) return;
    openReplyForm(commentId, mentionId);
  });

  /* ===============================
     COMMENT MENU
  =============================== */
  document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('.comment-menu-btn');
    if (menuBtn) {
      e.preventDefault();
      const menu = menuBtn.closest('.comment-menu');
      if (!menu) return;
      const wasOpen = menu.classList.contains('open');
      closeAllCommentMenus();
      if (!wasOpen) menu.classList.add('open');
      return;
    }

    const actionBtn = e.target.closest('.comment-menu-action');
    if (actionBtn) {
      e.preventDefault();
      const action = actionBtn.dataset.action;
      const commentId = actionBtn.dataset.commentId;
      const mentionId = actionBtn.dataset.mentionId;

      if (action === 'reply') {
        if (window.getReplyCooldownRemaining?.(commentId) > 0) return;
        openReplyForm(commentId, mentionId);
      } else if (action === 'share') {
        const url = buildCommentShareUrl(commentId);
        shareCommentUrl(url);
      } else if (action === 'report') {
        window.dispatchEvent(new CustomEvent('comment-report', { detail: { commentId } }));
      }

      closeAllCommentMenus();
      return;
    }

    if (!e.target.closest('.comment-menu')) {
      closeAllCommentMenus();
    }
  });


  /* ===============================
     CANCEL REPLY
  =============================== */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.cancel-reply');
    if (!btn) return;

    const form = btn.closest('.reply-form');
    if (!form) return;

    // 🔥 скрываем форму
    form.classList.add('d-none');

    const textarea = form.querySelector('textarea[name="text"]');
    if (textarea) {
      textarea.value = '';
      delete textarea.dataset.mentionId;
      textarea.style.height = 'auto';
    }

    // 🔥 УБИРАЕМ ТЕКСТ ОШИБКИ
    const errors = form.querySelector('.reply-form-errors');
    if (errors) {
      errors.textContent = '';
    }

    document
      .querySelectorAll('.comment-active')
      .forEach(el => el.classList.remove('comment-active'));
  });

  /* ===============================
     SUBMIT REPLY  🔥 КЛЮЧЕВОЙ БЛОК
  =============================== */
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('.reply-comment-form');
    if (!form) return;

    e.preventDefault();

    const textarea = form.querySelector('textarea[name="text"]');
    const errors = form.querySelector('.reply-form-errors');

    const parentId = form.dataset.parentId;
    const parentComment = document.getElementById('comment-' + parentId);
    if (!textarea || !errors || !parentComment) return;

    errors.textContent = '';

    const limitOk = window.enforceCommentLimit
      ? window.enforceCommentLimit(textarea, errors)
      : true;
    if (!limitOk) {
      textarea.focus();
      return;
    }

    let text = textarea.value.trim();
    if (!text) {
      errors.textContent = 'Please write a reply...';
      textarea.focus();
      return;
    }

    const mentionId = textarea.dataset.mentionId;
    if (mentionId) {
      text = `@[user:${mentionId}], ${text}`;
    }

    const trustStatusUrl = document.body.dataset.trustStatusUrl;
    if (trustStatusUrl) {
      try {
        const statusResp = await fetch(trustStatusUrl, {
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin'
        });
        if (statusResp.ok) {
          const statusData = await statusResp.json();
          if (statusData && statusData.shadow_banned) {
            errors.textContent = 'You have been shadow banned. Improve your trust score to restore access.';
            return;
          }
        }
      } catch (e) { /* ignore */ }
    }

    const fd = new FormData();
    fd.append('text', text);
    fd.append('parent_id', parentId);

    try {
      const replyContainer = form.closest('[data-reply-url]') || parentComment;
      const replyUrl = replyContainer?.dataset.replyUrl;
      if (!replyUrl) {
        errors.textContent = 'Reply URL not found.';
        return;
      }
      const threadUrl =
        parentComment?.dataset?.threadUrl ||
        `${window.location.origin}/blog/comment/${parentId}/thread/`;

      const csrfToken =
        document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
        getCookie('csrftoken') ||
        '';

      const resp = await fetch(replyUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: fd
      });

      const data = await parseJsonSafeReply(resp);
      if (!resp.ok || !data?.success) {
        errors.textContent = data?.error || 'Server error.';
        return;
      }

      try {
        // ⬇️ ВСТАВКА REPLY
        const isThreadView = !!getThreadContext();
        const parentDepth = parseInt(parentComment.dataset.depth || '0', 10);
        if (!isThreadView && parentDepth >= 2) {
          // For deep replies, keep only the thread link on item page
          let link = document.getElementById('replies-thread-link-' + parentId);
          if (!link) {
            const wrap = document.createElement('div');
            wrap.className = 'mt-4';
            wrap.appendChild(buildThreadLink(parentId, threadUrl, 1));
            parentComment.appendChild(wrap);
          } else {
            window.adjustThreadLinkCount?.(parentId, 1);
          }
          window.startReplyCooldown?.(parentId);
          closeAllReplyForms();
          return;
        }

        let replies = parentComment.querySelector('.replies');
        if (!replies) {
          replies = document.createElement('div');
          replies.className = 'replies';
          parentComment.appendChild(replies);
        }

        replies.insertAdjacentHTML('afterbegin', data.comment_html);
        window.initCommentToggles?.(replies);
        window.initAllReplyButtonsCooldown?.();

        // if we're on thread page, ensure empty state cleared and link removal flag reset
        const threadContext = getThreadContext();
        if (threadContext) {
          const threadParentId = threadContext.parentId;
          if (threadParentId) {
            const threadEmpty = document.getElementById('threadEmpty');
            if (threadEmpty) threadEmpty.classList.add('d-none');
            try {
              sessionStorage.removeItem('thread_remove_link_' + threadParentId);
            } catch { }
            const threadRoot = document.getElementById('comment-' + threadParentId);
            const threadReplies = threadRoot?.querySelector('.replies');
            const replyCount = window.countDirectReplyBlocks
              ? window.countDirectReplyBlocks(threadReplies)
              : 0;
            try {
              sessionStorage.setItem('thread_replies_count_' + threadParentId, String(replyCount));
            } catch { }
          }
        }

        window.startReplyCooldown?.(parentId);
        closeAllReplyForms();
      } catch (renderErr) {
        errors.textContent = 'Render error.';
      }
    } catch (err) {
      errors.textContent = 'Unable to submit. Please try again.';
    }
  });

  window.initAllReplyButtonsCooldown?.();

})();



//@mention listing
(function () {
  'use strict';
  let scrollTimer = null;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.mention-link');
    if (!link) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const commentId = link.dataset.parentId;
    if (window.ensureCommentVisible) {
      window.ensureCommentVisible(commentId);
    } else if (window.ensureRootCommentVisible) {
      window.ensureRootCommentVisible(commentId);
    }
    const comment = document.getElementById(`comment-${commentId}`);
    if (!comment) {
      return;
    }

    const rect = comment.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    const header = document.querySelector('header.header') || document.querySelector('.header');
    const headerH = header ? Math.ceil(header.getBoundingClientRect().height || 0) : 0;
    const SAFE_GAP = 12;

    /* ===============================
       НАСТРОЙКИ ОБЗОРА
    =============================== */
    const VIEW_TOP_OFFSET = headerH + SAFE_GAP;   // 👈 ЗОНА ОБЗОРА СВЕРХУ
    const VIEW_BOTTOM_OFFSET = 100; // 👈 снизу
    const SCROLL_OFFSET = headerH + SAFE_GAP;     // 👈 куда реально скроллим

    const isVisible =
      rect.top >= VIEW_TOP_OFFSET &&
      rect.bottom <= vh - VIEW_BOTTOM_OFFSET;

    // ✅ если уже в зоне видимости — только подсветка + bounce
    if (isVisible) {
      if (scrollTimer) {
        clearTimeout(scrollTimer);
        scrollTimer = null;
      }
      highlightComment(comment);
      return;
    }

    // 🔥 скроллим ЧУТЬ ВЫШЕ комментария
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetY = rect.top + scrollTop - SCROLL_OFFSET;

    window.scrollTo({
      top: targetY,
      behavior: 'auto'
    });

    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      highlightComment(comment);
      scrollTimer = null;
    }, 300);
  });

  function highlightComment(comment) {
    const text = comment.querySelector('.comment-text');
    if (!text) return;

    // снять со всех
    document
      .querySelectorAll('.comment-text.root-mention-highlight')
      .forEach(el => el.classList.remove('root-mention-highlight'));

    // перезапуск анимации без ожидания завершения предыдущей
    text.classList.remove('root-mention-highlight');
    void text.offsetWidth; // 🔥 принудительный reflow
    text.classList.add('root-mention-highlight');
  }

  function highlightCommentFromHash() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#comment-anchor-')) return;
    const id = hash.replace('#comment-anchor-', '').trim();
    if (!id) return;
    if (window.ensureCommentVisible) {
      window.ensureCommentVisible(id);
    } else if (window.ensureRootCommentVisible) {
      window.ensureRootCommentVisible(id);
    }
    const comment = document.getElementById(`comment-${id}`);
    if (!comment) return;
    setTimeout(() => highlightComment(comment), 120);
  }

  window.highlightCommentFromHash = highlightCommentFromHash;
  window.addEventListener('hashchange', highlightCommentFromHash);
})();


// Short annotation
function buildShortHTML(fullHTML, maxLen = 400) {
  const tmp = document.createElement('div');
  tmp.innerHTML = fullHTML;

  let count = 0;

  function walk(node) {
    if (count >= maxLen) {
      node.remove();
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const remaining = maxLen - count;

      if (node.textContent.length > remaining) {
        node.textContent = node.textContent.slice(0, remaining) + '…';
        count = maxLen;
      } else {
        count += node.textContent.length;
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(walk);

      // если элемент стал пустым — удалить
      if (!node.textContent.trim()) {
        node.remove();
      }
    }
  }

  Array.from(tmp.childNodes).forEach(walk);
  return tmp.innerHTML;
}


// comments-toggle.js (MENTION-SAFE)
(function () {
  function initCommentToggles(root = document) {
    root.querySelectorAll('.comment-text').forEach(textEl => {
      if (textEl.dataset.toggleInit) return;

      if (textEl.textContent.trim().length <= 350) return;

      textEl.dataset.fullHtml ||= textEl.innerHTML;

      const btn = document.createElement('button');
      btn.className = 'comment-toggle-btn';
      btn.textContent = 'Show more';

      let expanded = false;

      function render() {
        textEl.innerHTML = expanded
          ? textEl.dataset.fullHtml
          : buildShortHTML(textEl.dataset.fullHtml, 350);

        btn.textContent = expanded ? 'Show less' : 'Show more';
      }

      btn.addEventListener('click', () => {
        expanded = !expanded;
        render();
      });

      render();
      textEl.after(btn);
      textEl.dataset.toggleInit = '1';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCommentToggles();
  });

  window.initCommentToggles = initCommentToggles;
})();


// comments-root-pagination.js (STEP must match COMMENT_ROOT_PAGINATION_STEP in views.py)
(function () {
  const STEP = 50;
  let paginationState = null; // Сохраняем состояние пагинации
  let collapseMode = false;

  function initialVisibleCount(container) {
    const parsed = parseInt(container?.dataset?.minRootVisible || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.max(STEP, parsed) : STEP;
  }

  function initRootCommentsPagination(preserveState = false) {
    const container = document.getElementById('commentsList');
    const btn = document.getElementById('showMoreBtn');
    const wrapper = document.getElementById('showMoreWrapper');

    // Если контейнера нет, выходим
    if (!container) return;

    const rootComments = Array.from(
      container.querySelectorAll(':scope > .comment-block')
    );

    const total = rootComments.length;
    const chunkStart = preserveState ? STEP : initialVisibleCount(container);

    // 👉 если комментариев <= STEP — скрываем кнопку (если она есть)
    if (total <= STEP) {
      if (wrapper) {
        wrapper.classList.add('d-none');
      }
      rootComments.forEach(el => (el.style.display = ''));
      paginationState = null; // Сбрасываем состояние
      return;
    }

    // 👉 если > STEP — кнопка ОБЯЗАНА быть видимой
    // Если wrapper не существует, создаем его динамически
    if (!wrapper) {
      const newWrapper = document.createElement('div');
      newWrapper.id = 'showMoreWrapper';
      newWrapper.className = 'd-flex justify-content-start align-items-center mt-2';
      
      const newBtn = document.createElement('button');
      newBtn.id = 'showMoreBtn';
      newBtn.type = 'button';
      newBtn.className = 'show-more-btn-toggle';
      newBtn.textContent = 'Show more';
      
      newWrapper.appendChild(newBtn);
      // Вставляем после контейнера комментариев
      container.parentElement?.insertBefore(newWrapper, container.nextSibling);
      
      // Обновляем ссылки и рекурсивно вызываем функцию
      return initRootCommentsPagination(preserveState);
    }
    
    // Показываем wrapper
    wrapper.classList.remove('d-none');
    
    // Если кнопки нет, выходим
    if (!btn) return;

    // Если количество перешло через порог 10 — сразу схлопываем к первым 10
    const forceCollapse = total > STEP && (!paginationState || paginationState.total <= STEP);

    // Если нужно сохранить состояние и оно есть - используем его
    // Иначе — STEP или server data-min-root-visible (уведомления / focus_comment)
    let visibleCount = (preserveState && paginationState && !forceCollapse)
      ? Math.min(paginationState.visibleCount, total)
      : chunkStart;

    // Если сохраненное состояние больше текущего total, корректируем
    if (visibleCount > total) {
      visibleCount = Math.max(STEP, total);
    }
    collapseMode = (preserveState && paginationState && !forceCollapse)
      ? Boolean(paginationState.collapseMode)
      : false;

    function showRange(from, to, animate = false) {
      for (let i = from; i < to; i++) {
        const el = rootComments[i];
        if (!el) continue;

        el.style.display = '';
        if (animate) {
          el.classList.remove('listing-animate');
          void el.offsetWidth;
          el.classList.add('listing-animate');
        }
      }
    }

    function getVisibleCount() {
      return rootComments.reduce((acc, el) => acc + (el.style.display === 'none' ? 0 : 1), 0);
    }

    function updateUI() {
      if (!wrapper || !btn) return;
      if (total <= STEP) {
        wrapper.classList.add('d-none');
        collapseMode = false;
        return;
      }
      if (collapseMode && visibleCount <= STEP) {
        collapseMode = false;
      }
      wrapper.classList.remove('d-none');
      btn.textContent = collapseMode ? 'Show less' : 'Show more';
    }

    // Применяем видимость: показываем комментарии до visibleCount
    rootComments.forEach((el, i) => {
      el.style.display = i < visibleCount ? '' : 'none';
    });

    collapseMode = total > STEP && visibleCount >= total ? true : collapseMode;
    updateUI();

    btn.onclick = () => {
      visibleCount = Math.max(getVisibleCount(), STEP);
      if (!collapseMode) {
        const next = Math.min(visibleCount + STEP, total);
        showRange(visibleCount, next, true);
        visibleCount = next;
        if (visibleCount >= total) {
          collapseMode = true;
        }
      } else {
        const next = Math.max(STEP, visibleCount - STEP);
        for (let i = next; i < visibleCount; i++) {
          const el = rootComments[i];
          if (!el) continue;
          el.classList.remove('listing-animate');
          el.style.display = 'none';
        }
        visibleCount = next;
      }
      paginationState = { visibleCount, total, collapseMode };
      updateUI();
    };

    // Сохраняем текущее состояние
    paginationState = { visibleCount, total, collapseMode };
  }

  // 🔥 ГЛОБАЛЬНЫЙ ХУК ДЛЯ AJAX - сохраняем состояние при обновлении
  window.refreshRootCommentsPagination = function() {
    initRootCommentsPagination(true); // preserveState = true
  };

  // Ensure a root comment is visible for hash navigation
  function findRootComment(container, target) {
    if (!container || !target) return null;
    let current = target.closest?.('.comment-block') || target;
    while (current && current.parentElement && current.parentElement !== container) {
      current = current.parentElement.closest?.('.comment-block');
    }
    if (current && current.parentElement === container) return current;
    return null;
  }

  window.ensureCommentVisible = function(commentId) {
    const container = document.getElementById('commentsList');
    if (!container) return false;
    const target = document.getElementById(`comment-${commentId}`);
    if (!target) return false;
    const rootTarget = findRootComment(container, target);
    if (!rootTarget) return false;
    const rootComments = Array.from(
      container.querySelectorAll(':scope > .comment-block')
    );
    const index = rootComments.indexOf(rootTarget);
    if (index === -1) return false;

    const total = rootComments.length;
    const neededVisible = Math.max(index + 1, STEP);
    paginationState = {
      visibleCount: Math.min(neededVisible, total),
      total,
      collapseMode: neededVisible >= total
    };
    initRootCommentsPagination(true);
    return true;
  };
  window.ensureRootCommentVisible = window.ensureCommentVisible;

  document.addEventListener('DOMContentLoaded', () => {
    initRootCommentsPagination(false);
    if (window.highlightCommentFromHash) {
      window.highlightCommentFromHash();
    }
  });
})();



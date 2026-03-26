/**
 * Admin table bulk selection and delete.
 * - Select-all (scoped to visible rows when pagination exists)
 * - Delete button in toolbar (visible when selection non-empty)
 * - Custom modal confirmation
 */
(function() {
  'use strict';

  function getCsrfToken() {
    var input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input) return input.value;
    return (typeof window.ADMIN_CSRF_TOKEN === 'string' && window.ADMIN_CSRF_TOKEN) ? window.ADMIN_CSRF_TOKEN : '';
  }

  var bulkDeleteModal, bulkDeleteTitle, bulkDeleteConfirmBtn, bulkDeleteCancelBtn, bulkDeleteBackdrop;
  var pendingSubmit = null;
  var lastModalTrigger = null;

  function openBulkModal(count, onConfirm, opts) {
    if (!bulkDeleteModal) return;
    opts = opts || {};
    lastModalTrigger = opts.trigger || null;
    var msg = opts.title || (count === 1
      ? 'Are you sure you want to delete this item?'
      : 'Are you sure you want to delete ' + count + ' items?');
    if (bulkDeleteTitle) bulkDeleteTitle.textContent = msg;
    if (bulkDeleteConfirmBtn) {
      bulkDeleteConfirmBtn.textContent = opts.confirmText || 'Delete';
      bulkDeleteConfirmBtn.className = 'admin-button ' + (opts.buttonClass || 'admin-button-danger');
    }
    pendingSubmit = onConfirm;
    bulkDeleteModal.removeAttribute('hidden');
    bulkDeleteModal.classList.add('is-open');
    bulkDeleteModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeBulkDeleteModal() {
    if (!bulkDeleteModal) return;
    if (bulkDeleteModal.contains(document.activeElement)) {
      if (lastModalTrigger && typeof lastModalTrigger.focus === 'function') {
        lastModalTrigger.focus({ preventScroll: true });
      } else {
        var fallback = document.querySelector('.admin-toolbar button');
        if (fallback) fallback.focus({ preventScroll: true });
      }
    }
    bulkDeleteModal.classList.remove('is-open');
    bulkDeleteModal.setAttribute('aria-hidden', 'true');
    bulkDeleteModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    pendingSubmit = null;
    lastModalTrigger = null;
  }

  function initBulkDeleteModal() {
    bulkDeleteModal = document.getElementById('adminBulkDeleteModal');
    bulkDeleteTitle = document.getElementById('adminBulkDeleteModalTitle');
    bulkDeleteConfirmBtn = document.getElementById('adminBulkDeleteConfirmBtn');
    bulkDeleteCancelBtn = document.getElementById('adminBulkDeleteCancelBtn');
    bulkDeleteBackdrop = document.getElementById('adminBulkDeleteModalBackdrop');
    if (bulkDeleteBackdrop) bulkDeleteBackdrop.addEventListener('click', closeBulkDeleteModal);
    if (bulkDeleteCancelBtn) bulkDeleteCancelBtn.addEventListener('click', closeBulkDeleteModal);
    if (bulkDeleteConfirmBtn) {
      bulkDeleteConfirmBtn.addEventListener('click', function() {
        if (pendingSubmit && typeof pendingSubmit === 'function') pendingSubmit();
        closeBulkDeleteModal();
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && bulkDeleteModal && bulkDeleteModal.classList.contains('is-open')) {
        closeBulkDeleteModal();
      }
    });
  }

  var BULK_ACTIONS = [
    { attr: 'data-bulk-unban-url', formClass: 'admin-bulk-unban-form', btnClass: 'admin-bulk-unban-btn', btnText: 'Unban', btnStyle: 'admin-button-primary', modalTitle: function(n) { return n === 1 ? 'Are you sure you want to unban this user?' : 'Are you sure you want to unban ' + n + ' users?'; }, confirmText: 'Unban' },
    { attr: 'data-bulk-ban-url', formClass: 'admin-bulk-ban-form', btnClass: 'admin-bulk-ban-btn', btnText: 'Ban', btnStyle: 'admin-button-warning', modalTitle: function(n) { return n === 1 ? 'Are you sure you want to ban this user?' : 'Are you sure you want to ban ' + n + ' users?'; }, confirmText: 'Ban' },
    { attr: 'data-bulk-restore-url', formClass: 'admin-bulk-restore-form', btnClass: 'admin-bulk-recover-btn', btnText: 'Recovery', btnStyle: 'admin-button-primary', modalTitle: function(n) { return n === 1 ? 'Recover this item?' : 'Recover ' + n + ' selected items?'; }, confirmText: 'Recovery' },
    { attr: 'data-bulk-clear-url', formClass: 'admin-bulk-clear-form', btnClass: 'admin-bulk-clear-btn', btnText: 'Clear', btnStyle: 'admin-button-warning', modalTitle: function() { return 'Are you sure about cleaning?'; }, confirmText: 'Clear' },
    { attr: 'data-bulk-delete-url', formClass: 'admin-bulk-delete-form', btnClass: 'admin-bulk-delete-btn', btnText: 'Delete', btnStyle: 'admin-button-danger', modalTitle: function(n) { return n === 1 ? 'Are you sure you want to permanently delete this item?' : 'Are you sure you want to permanently delete ' + n + ' items?'; }, confirmText: 'Delete' },
    { attr: 'data-bulk-delete-content-url', formClass: 'admin-bulk-delete-content-form', btnClass: 'admin-bulk-delete-content-btn', btnText: 'Delete', btnStyle: 'admin-button-danger', modalTitle: function(n) { return n === 1 ? 'Are you sure you want to delete this content (post/comment)?' : 'Are you sure you want to delete ' + n + ' selected posts/comments?'; }, confirmText: 'Delete' }
  ];

  function init() {
    initBulkDeleteModal();
    var tables = document.querySelectorAll('.admin-table[data-bulk-delete-url], .admin-table[data-bulk-clear-url], .admin-table[data-bulk-delete-content-url], .admin-table[data-bulk-unban-url], .admin-table[data-bulk-ban-url], .admin-table[data-bulk-restore-url]');
    tables.forEach(function(table) {
      setupTable(table);
    });
  }

  function setupTable(table) {
    var selectAll = table.querySelector('.admin-bulk-select-all');
    var rowChecks = table.querySelectorAll('.admin-bulk-row-check');
    var card = table.closest('.admin-card');
    var toolbar = document.querySelector('.admin-toolbar');
    var recentDeletedKind = table.getAttribute('data-recent-deleted-kind');

    if (!toolbar && card) {
      toolbar = document.createElement('div');
      toolbar.className = 'admin-toolbar';
      card.parentNode.insertBefore(toolbar, card);
    }
    if (!toolbar) return;

    /* Backups page: bulk forms go next to «Create backup» inside this row */
    var bulkAppendParent = toolbar.querySelector('.admin-backups-create-actions-row');

    function getSelectedIds(tbl) {
      var ids = [];
      tbl.querySelectorAll('.admin-bulk-row-check:checked').forEach(function(cb) {
        var id = cb.value || cb.getAttribute('data-id');
        if (id) ids.push(id);
      });
      return ids;
    }

    function updateAllButtons() {
      var ids = getSelectedIds(table);
      var banActiveOnly = table.getAttribute('data-bulk-ban-active-only') === '1';
      var allSelectedActive = true;
      if (banActiveOnly && ids.length > 0) {
        table.querySelectorAll('.admin-bulk-row-check:checked').forEach(function(cb) {
          var row = cb.closest('tr');
          if (row && row.getAttribute('data-is-active') !== '1') allSelectedActive = false;
        });
      }
      toolbar.querySelectorAll('.admin-bulk-unban-btn, .admin-bulk-delete-btn, .admin-bulk-clear-btn, .admin-bulk-delete-content-btn, .admin-bulk-recover-btn').forEach(function(btn) {
        btn.style.display = ids.length > 0 ? '' : 'none';
      });
      var banBtn = toolbar.querySelector('.admin-bulk-ban-btn');
      if (banBtn) {
        banBtn.style.display = (ids.length > 0 && (!banActiveOnly || allSelectedActive)) ? '' : 'none';
      }
    }

    BULK_ACTIONS.forEach(function(action) {
      var bulkUrl = table.getAttribute(action.attr);
      if (!bulkUrl) return;

      var form = toolbar.querySelector('form.' + action.formClass);
      if (!form) {
        form = document.createElement('form');
        form.method = 'post';
        form.action = bulkUrl + (window.location.search ? window.location.search : '');
        form.className = action.formClass;
        /* display: let CSS (.admin-bulk-delete-form { inline-flex }) control; inline would break flex alignment in toolbars */
        var csrf = document.createElement('input');
        csrf.type = 'hidden';
        csrf.name = 'csrfmiddlewaretoken';
        csrf.value = getCsrfToken();
        form.appendChild(csrf);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-button ' + action.btnStyle + ' ' + action.btnClass;
        btn.style.display = 'none';
        btn.textContent = action.btnText;
        form.appendChild(btn);
        var appendTarget = bulkAppendParent || toolbar;
        appendTarget.appendChild(form);

        btn.addEventListener('click', function() {
          var ids = getSelectedIds(table);
          if (ids.length === 0) return;
          openBulkModal(ids.length, function() {
            var prevKind = form.querySelector('input.admin-bulk-kind-field');
            if (prevKind) prevKind.remove();
            if (recentDeletedKind) {
              var kindInp = document.createElement('input');
              kindInp.type = 'hidden';
              kindInp.name = 'kind';
              kindInp.value = recentDeletedKind;
              kindInp.className = 'admin-bulk-kind-field';
              form.appendChild(kindInp);
            }
            var container = form.querySelector('.admin-bulk-ids');
            if (container) container.remove();
            container = document.createElement('div');
            container.className = 'admin-bulk-ids';
            container.style.display = 'none';
            ids.forEach(function(id) {
              var inp = document.createElement('input');
              inp.type = 'hidden';
              inp.name = 'ids';
              inp.value = id;
              container.appendChild(inp);
            });
            form.appendChild(container);
            form.submit();
          }, { title: action.modalTitle(ids.length), confirmText: action.confirmText, buttonClass: action.btnStyle, trigger: btn });
        });
      }

    });

    if (selectAll) {
      selectAll.addEventListener('change', function() {
        var hasPagination = card && card.querySelector('.admin-pagination');
        var checkboxes = hasPagination
          ? table.querySelectorAll('tbody tr .admin-bulk-row-check')
          : table.querySelectorAll('.admin-bulk-row-check');
        checkboxes.forEach(function(cb) {
          cb.checked = selectAll.checked;
        });
        updateAllButtons();
      });
    }
    rowChecks.forEach(function(cb) {
      cb.addEventListener('change', updateAllButtons);
    });

    updateAllButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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

  function openBulkModal(count, onConfirm, opts) {
    if (!bulkDeleteModal) return;
    opts = opts || {};
    var msg = opts.title || (count === 1
      ? 'Are you sure you want to delete this item?'
      : 'Are you sure you want to delete ' + count + ' items?');
    if (bulkDeleteTitle) bulkDeleteTitle.textContent = msg;
    if (bulkDeleteConfirmBtn) bulkDeleteConfirmBtn.textContent = opts.confirmText || 'Delete';
    pendingSubmit = onConfirm;
    bulkDeleteModal.removeAttribute('hidden');
    bulkDeleteModal.classList.add('is-open');
    bulkDeleteModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeBulkDeleteModal() {
    if (!bulkDeleteModal) return;
    bulkDeleteModal.classList.remove('is-open');
    bulkDeleteModal.setAttribute('aria-hidden', 'true');
    bulkDeleteModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    pendingSubmit = null;
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

  function init() {
    initBulkDeleteModal();
    var tables = document.querySelectorAll('.admin-table[data-bulk-delete-url], .admin-table[data-bulk-clear-url]');
    tables.forEach(function(table) {
      setupTable(table);
    });
  }

  function setupTable(table) {
    var bulkUrl = table.getAttribute('data-bulk-delete-url') || table.getAttribute('data-bulk-clear-url');
    var isClear = !!table.getAttribute('data-bulk-clear-url');
    if (!bulkUrl) return;

    var selectAll = table.querySelector('.admin-bulk-select-all');
    var rowChecks = table.querySelectorAll('.admin-bulk-row-check');
    var card = table.closest('.admin-card');
    var toolbar = document.querySelector('.admin-toolbar');

    if (!toolbar && card) {
      toolbar = document.createElement('div');
      toolbar.className = 'admin-toolbar';
      card.parentNode.insertBefore(toolbar, card);
    }
    if (!toolbar) return;

    var formClass = isClear ? 'admin-bulk-clear-form' : 'admin-bulk-delete-form';
    var btnClass = isClear ? 'admin-bulk-clear-btn' : 'admin-bulk-delete-btn';
    var form = toolbar.querySelector('form.' + formClass);
    if (!form) {
      form = document.createElement('form');
      form.method = 'post';
      form.action = bulkUrl + (window.location.search ? window.location.search : '');
      form.className = formClass;
      form.style.display = 'inline';
      var csrf = document.createElement('input');
      csrf.type = 'hidden';
      csrf.name = 'csrfmiddlewaretoken';
      csrf.value = getCsrfToken();
      form.appendChild(csrf);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-button admin-button-danger ' + btnClass;
      btn.style.display = 'none';
      btn.textContent = isClear ? 'Clear' : 'Delete';
      form.appendChild(btn);
      toolbar.appendChild(form);

      btn.addEventListener('click', function() {
        var ids = getSelectedIds(table);
        if (ids.length === 0) return;
        var modalOpts = isClear ? { title: 'Are you sure about cleaning?', confirmText: 'Clear' } : null;
        openBulkModal(ids.length, function() {
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
        }, modalOpts);
      });
    }

    var deleteBtn = form.querySelector('.' + btnClass);

    function getSelectedIds(tbl) {
      var ids = [];
      tbl.querySelectorAll('.admin-bulk-row-check:checked').forEach(function(cb) {
        var id = cb.value || cb.getAttribute('data-id');
        if (id) ids.push(id);
      });
      return ids;
    }

    function updateDeleteButton() {
      var ids = getSelectedIds(table);
      deleteBtn.style.display = ids.length > 0 ? '' : 'none';
    }

    if (selectAll) {
      selectAll.addEventListener('change', function() {
        var hasPagination = card && card.querySelector('.admin-pagination');
        var checkboxes = hasPagination
          ? table.querySelectorAll('tbody tr .admin-bulk-row-check')
          : table.querySelectorAll('.admin-bulk-row-check');
        checkboxes.forEach(function(cb) {
          cb.checked = selectAll.checked;
        });
        updateDeleteButton();
      });
    }

    rowChecks.forEach(function(cb) {
      cb.addEventListener('change', updateDeleteButton);
    });

    updateDeleteButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

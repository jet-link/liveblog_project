/**
 * Admin UI — Sidebar toggle, fixes, alignment
 */
(function () {
  'use strict';

  function fixMismatchedLabels() {
    var labels = document.querySelectorAll('label[for]');
    var suffixes = ['_from', '_to', '_0', '_1', '_input', '_display'];
    labels.forEach(function (label) {
      var forId = label.getAttribute('for');
      if (!forId) return;
      var target = document.getElementById(forId);
      if (target) return;
      for (var i = 0; i < suffixes.length; i++) {
        var alt = document.getElementById(forId + suffixes[i]);
        if (alt) {
          label.setAttribute('for', forId + suffixes[i]);
          return;
        }
      }
      var row = label.closest('.form-row, .flex-container, .fieldBox');
      if (row) {
        var focusable = row.querySelector('input:not([type="hidden"]), select, textarea, [tabindex="0"]');
        if (focusable && focusable.id) {
          label.setAttribute('for', focusable.id);
          return;
        }
      }
      label.removeAttribute('for');
    });
  }

  function initSidebarToggle() {
    const toggle = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('admin-sidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('is-open');
      document.body.classList.toggle('sidebar-open', sidebar.classList.contains('is-open'));
    });

    document.addEventListener('click', function (e) {
      if (sidebar.classList.contains('is-open') &&
          !sidebar.contains(e.target) &&
          !toggle.contains(e.target)) {
        sidebar.classList.remove('is-open');
        document.body.classList.remove('sidebar-open');
      }
    });
  }

  function init() {
    initSidebarToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', fixMismatchedLabels);
})();

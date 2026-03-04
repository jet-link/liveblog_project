/**
 * Admin UI — Sidebar toggle
 */
(function () {
  'use strict';

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarToggle);
  } else {
    initSidebarToggle();
  }
})();

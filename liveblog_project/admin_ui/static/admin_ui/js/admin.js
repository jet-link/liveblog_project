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

  function initBackupActionsDropdowns() {
    var dropdowns = document.querySelectorAll('.backup-actions-dropdown');
    if (!dropdowns.length) return;

    function positionMenu(dropdown) {
      var summary = dropdown.querySelector('summary');
      var menu = dropdown.querySelector('.backup-actions-menu');
      if (!summary || !menu) return;
      var rect = summary.getBoundingClientRect();
      var menuHeight = 90;
      var spaceBelow = window.innerHeight - rect.bottom;
      var openUpward = spaceBelow < menuHeight && rect.top > menuHeight;
      menu.style.position = 'fixed';
      menu.style.left = rect.left + 'px';
      menu.style.minWidth = rect.width + 'px';
      var menuH = menu.offsetHeight || menuHeight;
      if (openUpward) {
        menu.style.top = (rect.top - menuH) + 'px';
        menu.style.bottom = 'auto';
        menu.classList.add('opens-upward');
      } else {
        menu.style.top = rect.bottom + 'px';
        menu.style.bottom = 'auto';
        menu.classList.remove('opens-upward');
      }
      menu.classList.add('is-positioned-fixed');
    }

    function resetMenuPosition(dropdown) {
      var menu = dropdown.querySelector('.backup-actions-menu');
      if (menu) {
        menu.style.position = '';
        menu.style.top = '';
        menu.style.left = '';
        menu.style.minWidth = '';
        menu.classList.remove('is-positioned-fixed', 'opens-upward');
      }
    }

    dropdowns.forEach(function (dropdown) {
      dropdown.addEventListener('toggle', function () {
        if (dropdown.open) {
          dropdowns.forEach(function (other) {
            if (other !== dropdown && other.open) {
              resetMenuPosition(other);
              other.removeAttribute('open');
            }
          });
          requestAnimationFrame(function () {
            positionMenu(dropdown);
          });
        } else {
          resetMenuPosition(dropdown);
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.backup-actions-dropdown')) {
        dropdowns.forEach(function (d) {
          if (d.open) {
            resetMenuPosition(d);
            d.removeAttribute('open');
          }
        });
      }
    });

    window.addEventListener('scroll', function () {
      dropdowns.forEach(function (d) {
        if (d.open) {
          resetMenuPosition(d);
          d.removeAttribute('open');
        }
      });
    }, true);

    window.addEventListener('resize', function () {
      dropdowns.forEach(function (d) {
        if (d.open) {
          var menu = d.querySelector('.backup-actions-menu');
          if (menu && menu.classList.contains('is-positioned-fixed')) {
            positionMenu(d);
          }
        }
      });
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
    initBackupActionsDropdowns();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', fixMismatchedLabels);
})();

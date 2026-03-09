/**
 * Admin panel JS - theme toggle, mobile sidebar, instant search, confirm
 */
(function() {
  'use strict';

  var STORAGE_THEME = 'admin_theme';

  // Theme
  var root = document.documentElement;
  var themeToggle = document.getElementById('adminThemeToggle');
  var savedTheme = localStorage.getItem(STORAGE_THEME) || 'dark';
  if (savedTheme === 'light' && root.getAttribute('data-theme') !== 'light') {
    root.setAttribute('data-theme', 'light');
    if (themeToggle) themeToggle.textContent = '☀️';
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      var isLight = root.getAttribute('data-theme') === 'light';
      if (isLight) {
        root.removeAttribute('data-theme');
        themeToggle.textContent = '🌓';
        localStorage.setItem(STORAGE_THEME, 'dark');
      } else {
        root.setAttribute('data-theme', 'light');
        themeToggle.textContent = '☀️';
        localStorage.setItem(STORAGE_THEME, 'light');
      }
    });
  }

  // Mobile sidebar
  var sidebar = document.getElementById('adminSidebar');
  var overlay = document.getElementById('adminSidebarOverlay');
  var menuToggle = document.getElementById('adminMenuToggle');
  var sidebarClose = document.getElementById('adminSidebarClose');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('is-open');
    if (overlay) { overlay.classList.add('is-open'); overlay.setAttribute('aria-hidden', 'false'); }
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('is-open');
    if (overlay) { overlay.classList.remove('is-open'); overlay.setAttribute('aria-hidden', 'true'); }
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (menuToggle) menuToggle.addEventListener('click', openSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Close sidebar on nav click (mobile) or escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSidebar();
  });
  document.querySelectorAll('.admin-nav-item').forEach(function(link) {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 992) closeSidebar();
    });
  });

  // Debounce helper (300ms for instant search)
  function debounce(fn, ms) {
    var timeout;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
  }

  // Instant search
  var searchInputs = document.querySelectorAll('[data-instant-search]');
  searchInputs.forEach(function(input) {
    var form = input.closest('form');
    if (form) {
      input.addEventListener('input', debounce(function() { form.submit(); }, 300));
    }
  });

  // Confirm destructive actions
  document.querySelectorAll('[data-confirm]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      if (!confirm(el.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // Delete links - optional confirm
  document.querySelectorAll('.admin-action-delete').forEach(function(link) {
    if (!link.hasAttribute('data-no-confirm') && link.tagName === 'A') {
      link.addEventListener('click', function(e) {
        if (!confirm('Are you sure?')) e.preventDefault();
      });
    }
  });

  // Dropdowns: close others when opening one, position fixed overlay
  document.querySelectorAll('.admin-dropdown').forEach(function(dd) {
    var trigger = dd.querySelector('.admin-dropdown-trigger');
    var menu = dd.querySelector('.admin-dropdown-menu');
    if (trigger && menu) {
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = dd.classList.contains('is-open');
        document.querySelectorAll('.admin-dropdown.is-open').forEach(function(other) {
          other.classList.remove('is-open');
        });
        if (!wasOpen) {
          dd.classList.add('is-open');
          var tr = trigger.getBoundingClientRect();
          var mw = 140;
          if (menu.offsetWidth) mw = menu.offsetWidth;
          var left = Math.max(8, Math.min(tr.right - mw, window.innerWidth - mw - 8));
          menu.style.left = left + 'px';
          menu.style.top = (tr.bottom + 4) + 'px';
        }
      });
    }
  });
  document.addEventListener('click', function() {
    document.querySelectorAll('.admin-dropdown.is-open').forEach(function(dd) {
      dd.classList.remove('is-open');
    });
  });

  // Close dropdown when scrolling
  window.addEventListener('scroll', function() {
    document.querySelectorAll('.admin-dropdown.is-open').forEach(function(dd) {
      dd.classList.remove('is-open');
    });
  }, true);

})();

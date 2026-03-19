/**
 * Admin panel JS - theme toggle, mobile sidebar, instant search, confirm
 */
(function() {
  'use strict';

  var STORAGE_THEME = 'admin_theme';

  // Theme: light → moon (click to dark), dark → sun (click to light)
  function getAdminTheme() {
    return document.documentElement.getAttribute('data-theme') || '';
  }
  function isAdminLight() {
    return getAdminTheme() === 'light';
  }
  function syncAdminThemeIcon() {
    var icon = document.querySelector('.admin-theme-icon');
    if (!icon) return;
    var light = isAdminLight();
    icon.classList.remove('fa-moon', 'fa-sun');
    icon.classList.add(light ? 'fa-moon' : 'fa-sun');
  }
  function setAdminTheme(light) {
    var root = document.documentElement;
    if (light) {
      root.setAttribute('data-theme', 'light');
      try { localStorage.setItem(STORAGE_THEME, 'light'); } catch (e) {}
    } else {
      root.removeAttribute('data-theme');
      try { localStorage.setItem(STORAGE_THEME, 'dark'); } catch (e) {}
    }
    syncAdminThemeIcon();
  }

  (function initAdminTheme() {
    var root = document.documentElement;
    var saved = localStorage.getItem(STORAGE_THEME);
    if (saved === 'light') root.setAttribute('data-theme', 'light');
    syncAdminThemeIcon();

    var btn = document.getElementById('adminThemeToggle');
    if (btn) {
      btn.addEventListener('click', function() {
        setAdminTheme(!isAdminLight());
      });
    }

    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === 'data-theme') {
          syncAdminThemeIcon();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  })();

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

  // Sidebar collapse toggle (desktop)
  var STORAGE_COLLAPSED = 'admin_sidebar_collapsed';
  var collapseBtn = document.getElementById('adminSidebarCollapseToggle');
  var collapseIcon = collapseBtn ? collapseBtn.querySelector('.admin-sidebar-toggle-icon') : null;

  function applyCollapsed(collapsed) {
    if (!sidebar) return;
    var root = document.documentElement;
    if (collapsed) {
      root.classList.add('admin-sidebar-collapsed');
      sidebar.classList.add('admin-sidebar-collapsed');
      if (collapseIcon) { collapseIcon.classList.remove('fa-angle-left'); collapseIcon.classList.add('fa-angle-right'); }
    } else {
      root.classList.remove('admin-sidebar-collapsed');
      sidebar.classList.remove('admin-sidebar-collapsed');
      if (collapseIcon) { collapseIcon.classList.remove('fa-angle-right'); collapseIcon.classList.add('fa-angle-left'); }
    }
    try { localStorage.setItem(STORAGE_COLLAPSED, collapsed ? '1' : ''); } catch (e) {}
  }

  (function initCollapse() {
    if (window.innerWidth >= 993) {
      var saved = localStorage.getItem(STORAGE_COLLAPSED);
      if (saved === '1') {
        applyCollapsed(true);
      } else if (document.documentElement.classList.contains('admin-sidebar-collapsed')) {
        sidebar.classList.add('admin-sidebar-collapsed');
        if (collapseIcon) { collapseIcon.classList.remove('fa-angle-left'); collapseIcon.classList.add('fa-angle-right'); }
      }
    }
  })();

  if (collapseBtn) {
    collapseBtn.addEventListener('click', function() {
      if (window.innerWidth < 993) return;
      var collapsed = sidebar.classList.contains('admin-sidebar-collapsed');
      applyCollapsed(!collapsed);
    });
  }

  window.addEventListener('resize', function() {
    if (window.innerWidth < 993) {
      document.documentElement.classList.remove('admin-sidebar-collapsed');
      if (sidebar) sidebar.classList.remove('admin-sidebar-collapsed');
      if (collapseIcon) { collapseIcon.classList.remove('fa-angle-right'); collapseIcon.classList.add('fa-angle-left'); }
    } else {
      var saved = localStorage.getItem(STORAGE_COLLAPSED);
      if (saved === '1') applyCollapsed(true);
    }
  });

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
          function positionMenu() {
            var tr = trigger.getBoundingClientRect();
            var mw = menu.offsetWidth || 140;
            var mh = menu.offsetHeight || 200;
            var gap = 4;
            var pad = 8;
            var winW = window.innerWidth;
            var winH = window.innerHeight;
            var left = tr.right - mw;
            if (left < pad) left = pad;
            if (left + mw > winW - pad) left = winW - mw - pad;
            var top = tr.bottom + gap;
            if (top + mh > winH - pad) {
              top = tr.top - mh - gap;
              if (top < pad) top = pad;
            }
            menu.style.left = Math.round(left) + 'px';
            menu.style.top = Math.round(top) + 'px';
          }
          positionMenu();
          requestAnimationFrame(positionMenu);
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

  // Sign out confirmation modal
  var signoutModal = document.getElementById('adminSignoutModal');
  var signoutBackdrop = document.getElementById('adminSignoutModalBackdrop');
  var signoutConfirm = document.getElementById('adminSignoutConfirmBtn');
  var signoutCancel = document.getElementById('adminSignoutCancelBtn');
  var logoutUrl = typeof window.ADMIN_LOGOUT_URL === 'string' ? window.ADMIN_LOGOUT_URL : '';

  var signoutModalTrigger = null;

  function openSignoutModal(trigger) {
    if (!signoutModal) return;
    signoutModalTrigger = trigger || null;
    signoutModal.removeAttribute('hidden');
    signoutModal.classList.add('is-open');
    signoutModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeSignoutModal() {
    if (!signoutModal) return;
    if (signoutModal.contains(document.activeElement)) {
      if (signoutModalTrigger && typeof signoutModalTrigger.focus === 'function') {
        signoutModalTrigger.focus({ preventScroll: true });
      } else {
        var fallback = document.querySelector('.admin-signout-trigger, .admin-header button');
        if (fallback) fallback.focus({ preventScroll: true });
      }
    }
    signoutModal.classList.remove('is-open');
    signoutModal.setAttribute('aria-hidden', 'true');
    signoutModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    signoutModalTrigger = null;
  }

  document.querySelectorAll('.admin-signout-trigger').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      openSignoutModal(btn);
    });
  });
  if (signoutBackdrop) signoutBackdrop.addEventListener('click', closeSignoutModal);
  if (signoutCancel) signoutCancel.addEventListener('click', closeSignoutModal);
  if (signoutConfirm && logoutUrl) {
    signoutConfirm.addEventListener('click', function() {
      window.location.href = logoutUrl;
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && signoutModal && signoutModal.classList.contains('is-open')) {
      closeSignoutModal();
    }
  });

})();

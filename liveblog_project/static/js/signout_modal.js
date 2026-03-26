/**
 * Sign out confirmation modal – opens on .signout-trigger click,
 * confirms with "Sign out" button, cancels with Cancel or backdrop
 */
(function() {
  'use strict';

  const modalEl = document.getElementById('signoutConfirmModal');
  const confirmBtn = document.getElementById('signoutConfirmBtn');

  if (!modalEl || !confirmBtn) return;

  const logoutUrl = modalEl.dataset.logoutUrl || '';

  document.querySelectorAll('.signout-trigger').forEach(function(trigger) {
    trigger.addEventListener('click', function(e) {
      e.preventDefault();
      /* Close mobile slide menu so it does not sit above the modal (even with z-index fix) */
      var closeMenuBtn = document.getElementById('bottomMenuClose');
      var sideMenu = document.getElementById('bottomSideMenu');
      if (closeMenuBtn && sideMenu && sideMenu.classList.contains('open')) {
        closeMenuBtn.click();
      }
      if (typeof bootstrap !== 'undefined') {
        var showModal = function() {
          var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.show();
        };
        /* Let the drawer close animation finish */
        window.requestAnimationFrame(function() {
          window.setTimeout(showModal, 50);
        });
      }
    });
  });

  confirmBtn.addEventListener('click', function() {
    if (logoutUrl) window.location.href = logoutUrl;
  });
})();

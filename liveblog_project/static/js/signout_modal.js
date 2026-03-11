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
      if (typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    });
  });

  confirmBtn.addEventListener('click', function() {
    if (logoutUrl) window.location.href = logoutUrl;
  });
})();

/**
 * Admin filters - auto-submit on change for select filters
 */
(function() {
  'use strict';

  document.querySelectorAll('.admin-toolbar select').forEach(function(select) {
    select.addEventListener('change', function() {
      var form = select.closest('form');
      if (form) form.submit();
    });
  });

})();

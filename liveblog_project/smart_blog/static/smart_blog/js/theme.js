(function () {
  'use strict';

  var STORAGE_KEY = 'themeToggle';
  var ACTIVE_VAL = 'sun';
  var INACTIVE_VAL = 'moon';

  function isActive() {
    try {
      return localStorage.getItem(STORAGE_KEY) === ACTIVE_VAL;
    } catch (e) {
      return false;
    }
  }

  function setActive(active) {
    try {
      localStorage.setItem(STORAGE_KEY, active ? ACTIVE_VAL : INACTIVE_VAL);
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    if (isActive()) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', function () {
      btn.classList.toggle('active');
      setActive(btn.classList.contains('active'));
    });
  });
})();

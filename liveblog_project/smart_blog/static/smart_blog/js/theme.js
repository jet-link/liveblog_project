(function () {
  'use strict';

  var STORAGE_KEY = 'themeToggle';
  var ACTIVE_VAL = 'sun';

  function setTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try {
      localStorage.setItem(STORAGE_KEY, dark ? ACTIVE_VAL : 'moon');
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setTheme(!isDark);
    });
  });
})();

(function () {
  'use strict';

  var STORAGE_KEY = 'themeToggle';
  var ACTIVE_VAL = 'sun';

  function setTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try {
      localStorage.setItem(STORAGE_KEY, dark ? ACTIVE_VAL : 'moon');
    } catch (e) {}
    updateIcons(dark);
  }

  function updateIcons(isDark) {
    var icons = document.querySelectorAll('.theme-toggle-icon');
    icons.forEach(function (icon) {
      icon.classList.remove('fa-moon-o', 'fa-sun-o');
      icon.classList.add(isDark ? 'fa-sun-o' : 'fa-moon-o');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    updateIcons(isDark);

    var btns = document.querySelectorAll('#themeToggle, .theme-toggle-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dark = document.documentElement.getAttribute('data-theme') === 'dark';
        setTheme(!dark);
      });
    });
  });
})();

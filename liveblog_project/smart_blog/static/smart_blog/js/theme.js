(function () {
  'use strict';

  var STORAGE_KEY = 'themeToggle';
  var ACTIVE_VAL = 'sun';
  /* Иконка показывает действие при клике: light→луна (включить dark), dark→солнце (включить light) */

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function isDark() {
    return getTheme() === 'dark';
  }

  function setTheme(dark) {
    var theme = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? ACTIVE_VAL : 'moon');
    } catch (e) {}
    syncIcons();
  }

  function syncIcons() {
    var dark = isDark();
    var icons = document.querySelectorAll('.theme-toggle-icon');
    for (var i = 0; i < icons.length; i++) {
      var icon = icons[i];
      icon.classList.remove('fa-moon-o', 'fa-sun-o');
      icon.classList.add(dark ? 'fa-sun-o' : 'fa-moon-o');
      icon.setAttribute('aria-hidden', 'true');
    }
  }

  function handleToggle() {
    var dark = isDark();
    setTheme(!dark);
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncIcons();
    var btns = document.querySelectorAll('#themeToggle, .theme-toggle-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', handleToggle);
    }
  });
})();

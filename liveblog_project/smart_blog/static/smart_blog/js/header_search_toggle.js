// header_search_toggle.js – toggle search form below header on search-btn click
(function () {
    'use strict';

    const searchBtn = document.querySelector('.search-btn');
    const dropdown = document.getElementById('headerSearchDropdown');
    const SEARCH_ICON = 'fa-search';
    const CLOSE_ICON = 'fa-times';

    if (!searchBtn || !dropdown) return;

    function getIconEl() {
        return searchBtn.querySelector('i');
    }

    function isOpen() {
        return !dropdown.classList.contains('hidden');
    }

    function open() {
        dropdown.classList.remove('hidden');
        dropdown.setAttribute('aria-hidden', 'false');
        const icon = getIconEl();
        if (icon) {
            icon.classList.remove(SEARCH_ICON);
            icon.classList.add(CLOSE_ICON);
        }
    }

    function close() {
        dropdown.classList.add('hidden');
        dropdown.setAttribute('aria-hidden', 'true');
        const icon = getIconEl();
        if (icon) {
            icon.classList.remove(CLOSE_ICON);
            icon.classList.add(SEARCH_ICON);
        }
    }

    function toggle() {
        if (isOpen()) {
            close();
        } else {
            open();
        }
    }

    searchBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle();
    });
})();

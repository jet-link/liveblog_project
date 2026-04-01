// header_search_toggle.js — открытие/закрытие формы поиска под шапкой только кнопкой (.search-btn).
// Иконка fa-search ↔ fa-times. Клик по странице / Escape панель НЕ закрывают (только эта кнопка).
(function () {
    'use strict';

    function init() {
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

        function setExpanded(open) {
            searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        function open() {
            dropdown.classList.remove('hidden');
            dropdown.setAttribute('aria-hidden', 'false');
            const icon = getIconEl();
            if (icon) {
                icon.classList.remove(SEARCH_ICON);
                icon.classList.add(CLOSE_ICON);
            }
            searchBtn.setAttribute('aria-label', 'Close search');
            setExpanded(true);
        }

        function close() {
            dropdown.classList.add('hidden');
            dropdown.setAttribute('aria-hidden', 'true');
            const icon = getIconEl();
            if (icon) {
                icon.classList.remove(CLOSE_ICON);
                icon.classList.add(SEARCH_ICON);
            }
            searchBtn.setAttribute('aria-label', 'Search');
            setExpanded(false);
        }

        function onSearchBtnClick(e) {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen()) {
                close();
            } else {
                open();
            }
        }

        searchBtn.setAttribute('aria-expanded', 'false');
        searchBtn.setAttribute('aria-controls', 'headerSearchDropdown');
        searchBtn.addEventListener('click', onSearchBtnClick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// static/js/search-toggle.js
document.addEventListener('DOMContentLoaded', function () {
    const toggleBtn = document.querySelector('.search-toggle-btn');
    const overlay = document.getElementById('headerSearchOverlay');
    const input = document.getElementById('headerSearchInput');
    const clearBtn = document.getElementById('headerSearchClear');

    const chkTitle = document.getElementById('searchByTitle');
    const chkText = document.getElementById('searchByText');
    const chkTags = document.getElementById('searchByTags');

    if (!toggleBtn || !overlay || !input) return;

    function openSearch() {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        setTimeout(() => input.focus(), 120);
        updateClearVisibility();


        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');

        // 🔥 Очистить поле сразу при открытии окна поиска
        input.value = '';
        updateClearVisibility();

        setTimeout(() => input.focus(), 160);

    }
    function closeSearch() {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        input.value = '';
        updateClearVisibility();
    }

    toggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (overlay.classList.contains('active')) closeSearch();
        else openSearch();
    });

    document.addEventListener('click', function (e) {
        if (!overlay.classList.contains('active')) return;
        if (overlay.contains(e.target) || toggleBtn.contains(e.target)) return;
        closeSearch();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('active')) closeSearch();
    });

    function updateClearVisibility() {
        if (!clearBtn) return;
        const val = (input.value || '').trim();
        if (val.length > 0) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', function (e) {
            e.preventDefault();
            input.value = '';
            input.focus();
            updateClearVisibility();
        });
    }
    input.addEventListener('input', updateClearVisibility);

    // --- MAIN: Enter handler ---
    input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') {
            if (e.key === 'Escape') closeSearch();
            return;
        }
        e.preventDefault();

        const q = (input.value || '').trim();
        if (!q) return;

        // Build params from scratch — only include checked boxes
        const params = new URLSearchParams();
        params.set('q', q);

        if (chkTitle && chkTitle.checked) params.set('by_title', '1');
        if (chkText && chkText.checked) params.set('by_text', '1');
        if (chkTags && chkTags.checked) params.set('by_tags', '1');

        // DEBUG: покажи, что отправляем
        // console.log('Searching with params:', params.toString());

        // Если пользователь НЕ отметил ни одного чекбокса — по умолчанию искать по title+text
        if (!((chkTitle && chkTitle.checked) || (chkText && chkText.checked) || (chkTags && chkTags.checked))) {
            params.set('by_title', '1');
            params.set('by_text', '1');
            params.set('by_tags', '1');
        }

        window.location.href = '/search/?' + params.toString();
    });

    // при инициализации: если пришли с /search/?... — подставим query в поле и отметим чекбоксы
    (function initFromSearchParams() {
        try {
            const params = new URLSearchParams(window.location.search);
            const q = params.get('q') || '';
            if (q) {
                input.value = q;
                updateClearVisibility();
            }
            if (chkTitle) chkTitle.checked = params.get('by_title') === '1' || params.get('by_title') === 'true';
            if (chkText) chkText.checked = params.get('by_text') === '1' || params.get('by_text') === 'true';
            if (chkTags) chkTags.checked = params.get('by_tags') === '1' || params.get('by_tags') === 'true';
        } catch (err) { /* ignore */ }
    })();
});
// static/js/item-back.js — упрощённый, надёжный
(function () {
    'use strict';

    function getListingUrl() {
        try { return sessionStorage.getItem('listing_url') || null; }
        catch (e) { return null; }
    }

    function goToListing(rawUrl) {
        if (!rawUrl) {
            history.back();
            return;
        }
        try {
            const u = new URL(rawUrl, window.location.origin);
            // если совпадает с текущим, пробуем history.back
            if (u.toString() === window.location.href) {
                history.back();
            } else {
                // помечаем, чтобы список применил изменения
                try { sessionStorage.setItem('from_detail', '1'); } catch (e) { }
                window.location.href = u.toString();
            }
        } catch (e) {
            history.back();
        }
    }

    const backBtn = document.getElementById('backBreadcrumb');
    if (!backBtn) return;

    backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        const raw = getListingUrl();
        goToListing(raw);
    });
})();
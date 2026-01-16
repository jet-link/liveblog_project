// static/js/listing-memory.js
(function () {
    // Save clicks on item links (store page+scroll+anchor)
    document.addEventListener('click', function (ev) {
        const a = ev.target.closest && ev.target.closest('a.item-link');
        if (!a) return;
        const listUrl = window.location.pathname + window.location.search;
        sessionStorage.setItem('listing_url', listUrl);
        sessionStorage.setItem('listing_scroll', String(window.scrollY || window.pageYOffset || 0));
        const itemId = a.dataset.itemId;
        if (itemId) sessionStorage.setItem('listing_anchor', 'item-' + itemId);
    });

    // Instant restore: jump immediately to anchor or saved scroll (no smooth)
    function restoreListingPositionInstant() {
        const savedUrl = sessionStorage.getItem('listing_url');
        const curUrl = window.location.pathname + window.location.search;
        if (!savedUrl || savedUrl !== curUrl) return;

        const savedScroll = parseInt(sessionStorage.getItem('listing_scroll') || '0', 10);
        const savedAnchor = sessionStorage.getItem('listing_anchor');

        setTimeout(function () {
            if (savedAnchor) {
                const el = document.getElementById(savedAnchor);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const targetY = window.scrollY + rect.top;
                    window.scrollTo(0, targetY); // <-- МГНОВЕННЫЙ переход
                    return;
                }
            }
            window.scrollTo(0, savedScroll); // <-- тоже мгновенно
        }, 20);
    }

    // Use pageshow (handles bfcache) and DOMContentLoaded
    window.addEventListener('pageshow', restoreListingPositionInstant);
    window.addEventListener('DOMContentLoaded', restoreListingPositionInstant);
})();
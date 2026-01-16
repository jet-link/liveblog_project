// static/js/listing-apply-changes.js
(function () {
    'use strict';

    function applyListingChanges() {
        const key = 'listing_changes';
        let changes = {};
        try { changes = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (e) { changes = {}; }
        if (!changes || Object.keys(changes).length === 0) return;

        Object.entries(changes).forEach(([itemId, info]) => {
            // likes
            if (typeof info.likes_count !== 'undefined') {
                const likesNode = document.getElementById('likes-count-' + itemId);
                if (likesNode) likesNode.textContent = info.likes_count;
            }
            // bookmarks count
            if (typeof info.bookmarks_count !== 'undefined') {
                const bNode = document.getElementById('bookmark-count-' + itemId);
                if (bNode) bNode.textContent = info.bookmarks_count;
            }
            // bookmark icon (toggle class)
            if (typeof info.bookmarked !== 'undefined') {
                const bkIcon = document.getElementById('bookmark-icon-' + itemId) || document.querySelector('#bookmark-icon-' + itemId);
                if (bkIcon) {
                    if (info.bookmarked) {
                        bkIcon.classList.remove('fa-bookmark-o');
                        bkIcon.classList.add('fa-bookmark');
                    } else {
                        bkIcon.classList.remove('fa-bookmark');
                        bkIcon.classList.add('fa-bookmark-o');
                    }
                }
            }
            // views
            if (typeof info.views_count !== 'undefined') {
                const vNode = document.getElementById('views-count-' + itemId);
                if (vNode) vNode.textContent = info.views_count;
            }
        });

        // очистим после применения, чтобы не применять повторно
        try {
            sessionStorage.removeItem(key);
            sessionStorage.removeItem('from_detail');
        } catch (e) { /* ignore */ }
    }

    window.addEventListener('pageshow', applyListingChanges);
    window.addEventListener('DOMContentLoaded', applyListingChanges);
})();
// static/js/bookmark.js
(function () {
    'use strict';

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const c = cookies[i].trim();
                if (c.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(c.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const link = document.getElementById('bookmarkLink');
        if (!link) return;

        const icon = document.getElementById('bookmarkIcon');
        const bookmarkCountHidden = document.getElementById('bookmarkCount'); // hidden span on detail
        const itemId = link.dataset.itemId || document.body.dataset.itemId;
        const url = link.dataset.url;

        link.addEventListener('click', async function (e) {
            e.preventDefault();
            if (!url) return;

            link.classList.add('opacity-50');

            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json'
                    }
                });
                const data = await resp.json().catch(() => null);

                if (!resp.ok || !data || !data.success) {
                    const err = data && data.error ? data.error : 'Error';
                    console.warn(err);
                    return;
                }

                const bookmarked = !!data.bookmarked;
                const totalBookmarks = (typeof data.total_bookmarks !== 'undefined') ? data.total_bookmarks : (bookmarkCountHidden ? bookmarkCountHidden.textContent : null);
                const totalViews = (typeof data.total_views !== 'undefined') ? data.total_views : null;

                // update detail UI
                if (bookmarked) {
                    icon.classList.remove('fa-bookmark-o');
                    icon.classList.add('fa-bookmark');
                } else {
                    icon.classList.remove('fa-bookmark');
                    icon.classList.add('fa-bookmark-o');
                }
                if (bookmarkCountHidden && totalBookmarks !== null) {
                    bookmarkCountHidden.textContent = totalBookmarks;
                }

                icon.classList.add("btn-bounce");
                setTimeout(() => icon.classList.remove("btn-bounce"), 300);

                // save changes for list page
                try {
                    const key = 'listing_changes';
                    let changes = {};
                    try { changes = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (e) { changes = {}; }
                    changes[itemId] = changes[itemId] || {};
                    if (typeof totalBookmarks !== 'undefined' && totalBookmarks !== null) changes[itemId].bookmarks_count = totalBookmarks;
                    changes[itemId].bookmarked = bookmarked;
                    if (totalViews !== null) changes[itemId].views_count = totalViews;
                    sessionStorage.setItem(key, JSON.stringify(changes));
                } catch (e) { /* ignore */ }

            } catch (err) {
                console.error('BOOKMARK AJAX ERROR:', err);
            } finally {
                link.classList.remove('opacity-50');
            }
        });
    });
})();
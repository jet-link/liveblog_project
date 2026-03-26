/**
 * back_btn_nav.js
 * 1. Save current URL before navigating to tag page (for back-btn on tag_items_list)
 * 2. Handle back-btn click: navigate to saved URL or fallback
 */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // Save current page when user clicks a tag link (capture phase — before navigation)
    document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href*="/blog/tag/"]');
        if (a && a.href) {
            try {
                sessionStorage.setItem('tag_return_url', location.pathname + location.search);
            } catch (err) { }
        }
        var cat = e.target.closest('a[href*="/blog/brainews/category/"]');
        if (cat && cat.href) {
            try {
                sessionStorage.setItem('category_return_url', location.pathname + location.search);
            } catch (err) { }
        }
        var topic = e.target.closest('a[href*="/blog/topics/"]');
        if (topic && topic.href && !topic.href.match(/\/blog\/topics\/?$/)) {
            try {
                sessionStorage.setItem('category_return_url', location.pathname + location.search);
            } catch (err) { }
        }
    }, true);

    // Back-btn click handler
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.back-btn');
        if (!btn) return;
        e.preventDefault();
        var key = btn.getAttribute('data-return-key');
        var fallback = btn.getAttribute('data-fallback') || '/blog/brainews/';
        if (!key) {
            window.location.href = fallback;
            return;
        }
        try {
            var url = sessionStorage.getItem(key);
            if (url && typeof url === 'string' && url.charAt(0) === '/' && url.indexOf('//') < 0) {
                window.location.href = url;
            } else {
                window.location.href = fallback;
            }
        } catch (err) {
            window.location.href = fallback;
        }
    });
});

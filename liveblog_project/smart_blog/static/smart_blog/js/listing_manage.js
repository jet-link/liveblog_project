// static/js/listing-manager.js
// listing-memory + listing-apply-changes + breadcrumb-back
// ✅ browser back === breadcrumb
// ✅ no extra fetch
// ✅ no double views
// ✅ correct scroll + highlight

(function () {
    'use strict';

    if (location.pathname.includes('/edit')) {
        return;
    }

    /* ================= CONFIG ================= */
    const ALLOWED_PATTERNS = ['brainews', 'blog', '/profile', '/search', 'smart_blog'];

    function isAllowedPath(pathname) {
        try {
            const p = (pathname || location.pathname || '').toLowerCase();
            return ALLOWED_PATTERNS.some(t => p.includes(t));
        } catch {
            return false;
        }
    }


    /* ================= Storage helpers ================= */
    function setItem(k, v) { try { sessionStorage.setItem(k, v); } catch { } }
    function getItem(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
    function removeItem(k) { try { sessionStorage.removeItem(k); } catch { } }

    function clearListing() {
        removeItem('listing_url');
        removeItem('listing_scroll');
        removeItem('listing_anchor');
        removeItem('listing_changes');
    }

    function isProfilePage() {
        return location.pathname.includes('/profile/');
    }

    function getCurrentTab() {
        try {
            return new URL(location.href).searchParams.get('tab') || 'all';
        } catch {
            return 'all';
        }
    }

    function getCurrentPage() {
        try {
            const p = parseInt(new URL(location.href).searchParams.get('page') || '1', 10);
            return Number.isNaN(p) ? 1 : p;
        } catch {
            return 1;
        }
    }

    function updateTabCount(tab, delta) {
        const badge = document.querySelector('.custom_badge_danger[data-tab="' + tab + '"]');
        if (badge) {
            const n = parseInt(badge.textContent || '0', 10);
            if (!Number.isNaN(n)) badge.textContent = Math.max(0, n + delta);
        }

        const tabBadge = document.querySelector('.tab-count-badge[data-tab-count="' + tab + '"]');
        if (tabBadge) {
            const n = parseInt(tabBadge.textContent || '0', 10);
            if (!Number.isNaN(n)) tabBadge.textContent = Math.max(0, n + delta);
        }
    }

    function markProfileRemoval(itemId, tab) {
        try {
            const key = 'profile_removed';
            const removed = JSON.parse(sessionStorage.getItem(key) || '{}');
            removed[itemId] = removed[itemId] || {};
            removed[itemId][tab] = true;
            sessionStorage.setItem(key, JSON.stringify(removed));
        } catch { }
    }

    function wasProfileRemoved(itemId, tab) {
        try {
            const key = 'profile_removed';
            const removed = JSON.parse(sessionStorage.getItem(key) || '{}');
            return !!removed[itemId]?.[tab];
        } catch {
            return false;
        }
    }

    function ensureProfilePagination(tab) {
        if (!isProfilePage()) return;
        const cards = document.querySelectorAll('.item_block[data-item-id]');
        if (cards.length > 0) return;

        const currentPage = getCurrentPage();
        if (currentPage <= 1) return;

        const url = new URL(location.href);
        url.searchParams.set('tab', tab || 'all');
        url.searchParams.set('page', String(currentPage - 1));

        if (window.profileTabs && typeof window.profileTabs.fetchAndReplace === 'function') {
            window.profileTabs.fetchAndReplace(url.toString());
        } else {
            location.href = url.toString();
        }
    }

    function scrollToProfileTabs() {
        const tabs = document.querySelector('.tabs_block');
        if (tabs) {
            tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /* =====================================================
       1) SAVE LISTING STATE ON CARD CLICK
    ===================================================== */
    document.addEventListener('click', function (e) {
        if (!isAllowedPath(location.pathname + location.search)) return;

        const link = e.target.closest?.('a.item-link');
        if (!link) return;

        setItem('listing_url', location.pathname + location.search);
        setItem('listing_scroll', String(window.scrollY || 0));

        const itemId = link.dataset?.itemId;
        if (itemId) setItem('listing_anchor', 'item-' + itemId);
    }, { passive: true });

    /* =====================================================
       2) RESTORE SCROLL + HIGHLIGHT ON BACK
    ===================================================== */
    function restoreListingPosition() {
        if (!isAllowedPath(location.pathname + location.search)) {
            clearListing();
            return;
        }

        const savedUrl = getItem('listing_url');
        if (!savedUrl || savedUrl !== location.pathname + location.search) return;

        const anchorId = getItem('listing_anchor');
        if (!anchorId) return;

        const el = document.getElementById(anchorId);
        if (!el) return;

        requestAnimationFrame(() => {
            const rect = el.getBoundingClientRect();

            const OFFSET = Math.min(
                window.innerHeight * 0.35, // 35% экрана
                420                        // но не больше 420px
            );

            if (Math.abs(rect.top) > OFFSET) {
                window.scrollBy({
                    top: rect.top - OFFSET,
                    behavior: 'smooth'
                });
            }

            el.classList.remove('back-highlight');
            void el.offsetWidth;
            el.classList.add('back-highlight');
        });
    }

    window.addEventListener('pageshow', restoreListingPosition);
    document.addEventListener('DOMContentLoaded', restoreListingPosition);

    /* =====================================================
       3) APPLY listing_changes (likes / bookmarks / views / comments)
    ===================================================== */
    function applyListingChanges() {
        let changes = {};
        try {
            changes = JSON.parse(sessionStorage.getItem('listing_changes') || '{}');
        } catch { }

        if (!changes || Object.keys(changes).length === 0) return;

        Object.entries(changes).forEach(([itemId, data]) => {

            if (data.likes_count != null) {
                const n = document.getElementById('likes-count-' + itemId);
                if (n) n.textContent = data.likes_count;
            }

            if (data.bookmarks_count != null) {
                const n = document.getElementById('bookmark-count-' + itemId);
                if (n) n.textContent = data.bookmarks_count;
            }

            if (data.comments_count != null) {
                const n = document.getElementById('comments-count-' + itemId);
                if (n) n.textContent = data.comments_count;
            }

            if (data.views_count != null) {
                const n = document.getElementById('views-count-' + itemId);
                if (n) n.textContent = data.views_count;
            }

            if (data.bookmarked != null) {
                const icon = document.getElementById('bookmark-icon-' + itemId);
                if (icon) {
                    icon.classList.toggle('fa-bookmark', data.bookmarked);
                    icon.classList.toggle('fa-bookmark-o', !data.bookmarked);
                }
            }
        });
    }

    window.addEventListener('pageshow', applyListingChanges);
    document.addEventListener('DOMContentLoaded', applyListingChanges);

    /* =====================================================
       4) BREADCRUMB BACK = BROWSER BACK
    ===================================================== */
    (function wireBackBtn() {
        const btn = document.getElementById('backBreadcrumb');
        if (!btn) return;

        btn.addEventListener('click', function (e) {
            e.preventDefault();

            const listingUrl = getItem('listing_url');
            if (listingUrl) {
                try { setItem('from_detail', '1'); } catch { }
                location.href = listingUrl;
                return;
            }

            if (history.length > 1) {
                history.back();
            } else {
                location.href = '/';
            }
        });
    })();

    /* =====================================================
       5) CLEAR LISTING WHEN LEAVING ALLOWED PAGES
    ===================================================== */
    document.addEventListener('click', function (e) {
        const a = e.target.closest?.('a[href]');
        if (!a) return;

        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')
            || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        let target;
        try {
            target = new URL(href, location.origin);
        } catch {
            return;
        }

        if (target.origin === location.origin) {
            if (!isAllowedPath(target.pathname + target.search)) {
                clearListing();
            }
        } else {
            clearListing();
        }
    }, { passive: true });


    /* =====================================================
       6) REMOVE INVALID CARDS ON BFCache RESTORE (KEY FIX)
    ===================================================== */
    function removeInvalidProfileCards() {
        if (!isProfilePage()) return;

        const tab = new URL(location.href).searchParams.get('tab');
        if (!tab) return;

        let changes = {};
        try {
            changes = JSON.parse(sessionStorage.getItem('listing_changes') || '{}');
        } catch {
            return;
        }

        let removedCount = 0;
        document.querySelectorAll('.item_block[data-item-id]').forEach(card => {
            const itemId = card.dataset.itemId;
            if (!itemId || !changes[itemId]) return;

            const state = changes[itemId];
            const col = card.closest('.item-card');

            if (!col) return;

            if (tab === 'liked' && state.liked === false) {
                if (!wasProfileRemoved(itemId, 'liked')) {
                    col.remove();
                    removedCount += 1;
                    markProfileRemoval(itemId, 'liked');
                }
            }

            if (tab === 'bookmarked' && state.bookmarked === false) {
                if (!wasProfileRemoved(itemId, 'bookmarked')) {
                    col.remove();
                    removedCount += 1;
                    markProfileRemoval(itemId, 'bookmarked');
                }
            }
        });

        if (removedCount > 0) {
            updateTabCount(tab, -removedCount);
            ensureProfilePagination(tab);
            scrollToProfileTabs();
        }
    }

    window.addEventListener('pageshow', function (event) {
        if (!event.persisted) return;
        removeInvalidProfileCards();
    });

    document.addEventListener('DOMContentLoaded', removeInvalidProfileCards);
    window.addEventListener('profileTabContentReplaced', removeInvalidProfileCards);

    /* =====================================================
    7) REMOVE ITEM FROM PROFILE LISTS WITH SMOOTH ANIMATION
    ===================================================== */
    document.addEventListener('click', function (e) {
        const likeBtn = e.target.closest('#likeBtn');
        const bookmarkBtn = e.target.closest('#bookmarkLink');

        if (!likeBtn && !bookmarkBtn) return;

        // работаем ТОЛЬКО на странице профиля
        if (!location.pathname.includes('/profile/')) return;

        const article = e.target.closest('.item_block');
        if (!article) return;

        const card = article.closest('.item-card');
        if (!card) return;

        const tab = new URL(location.href).searchParams.get('tab');

        // ─────────────────────────────
        // helper: плавное удаление
        // ─────────────────────────────
        function smoothRemove(node) {
            const height = node.offsetHeight;

            // фиксируем высоту
            node.style.height = height + 'px';
            node.style.overflow = 'hidden';

            // следующий кадр — анимация
            requestAnimationFrame(() => {
                node.classList.add('fade-collapse');
                node.style.height = '0px';
                node.style.opacity = '0';
            });

            // удаляем после анимации
            setTimeout(() => {
                node.remove();
            }, 300);
        }

        // ─────────────────────────────
        // ЛОГИКА ТАБОВ
        // ─────────────────────────────
        if (tab === 'liked' && likeBtn) {
            // убрали лайк → публикация больше не должна быть в liked
            setTimeout(() => {
                smoothRemove(card);
                updateTabCount('liked', -1);
                const itemId = article.dataset.itemId;
                if (itemId) markProfileRemoval(itemId, 'liked');
                setTimeout(() => ensureProfilePagination(tab), 350);
                scrollToProfileTabs();
            }, 150);
        }

        if (tab === 'bookmarked' && bookmarkBtn) {
            // убрали bookmark → публикация больше не должна быть в bookmarked
            setTimeout(() => {
                smoothRemove(card);
                updateTabCount('bookmarked', -1);
                const itemId = article.dataset.itemId;
                if (itemId) markProfileRemoval(itemId, 'bookmarked');
                setTimeout(() => ensureProfilePagination(tab), 350);
                scrollToProfileTabs();
            }, 150);
        }
    });

})();


// static/js/item_views_sync.js
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const body = document.body;

        const itemId = body.dataset.itemId;
        const views = parseInt(body.dataset.viewsCount, 10);

        if (!itemId || Number.isNaN(views)) return;

        try {
            const key = 'listing_changes';
            const changes = JSON.parse(sessionStorage.getItem(key) || '{}');

            // СОХРАНЯЕМ АКТУАЛЬНОЕ ЗНАЧЕНИЕ С СЕРВЕРА
            changes[itemId] = changes[itemId] || {};
            changes[itemId].views_count = views;

            sessionStorage.setItem(key, JSON.stringify(changes));
        } catch { }
    });
})();
// static/js/listing-manager.js
// listing-memory + listing-apply-changes + breadcrumb-back
// ✅ browser back === breadcrumb
// ✅ no extra fetch
// ✅ no double views
// ✅ correct scroll + highlight

(function () {
    'use strict';

    if (location.pathname.includes('/edit/')) {
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
        removeItem('listing_instant');
        removeItem('listing_section_anchor');
        removeItem('listing_label');
        removeItem('profile_active_tab');
        removeItem('profile_back_url');
        removeItem('profile_back_anchor');
        removeItem('profile_from_detail');
    }

    function clearProfileListingState() {
        removeItem('listing_url');
        removeItem('listing_scroll');
        removeItem('listing_anchor');
        removeItem('listing_instant');
        removeItem('listing_section_anchor');
        removeItem('listing_label');
        removeItem('profile_active_tab');
        removeItem('profile_back_url');
        removeItem('profile_back_anchor');
        removeItem('profile_from_detail');
        try {
            Object.keys(sessionStorage).forEach((key) => {
                if (key.startsWith('section_scroll_index_')) {
                    sessionStorage.removeItem(key);
                }
            });
        } catch { }
    }
    window.clearProfileListingState = clearProfileListingState;

    function isProfilePage() {
        return location.pathname.includes('/profile/');
    }

    function isProfileSectionPage() {
        try {
            const parts = (location.pathname || '').split('/').filter(Boolean);
            return parts.length >= 3 && parts[0] === 'profile';
        } catch {
            return false;
        }
    }

    function getProfileSectionIdFromPath() {
        try {
            const parts = (location.pathname || '').split('/').filter(Boolean);
            if (parts.length >= 3 && parts[0] === 'profile') {
                return 'profile-section-' + parts[2];
            }
        } catch { }
        return null;
    }

    function getListingLabel() {
        if (isProfileSectionPage()) {
            const label = document.getElementById('profileSectionLabel');
            const countEl = document.querySelector('.custom_badge_success');
            const text = label?.textContent?.trim() || '';
            const count = countEl?.textContent?.trim() || '';
            if (text && count) return `${text} (${count})`;
            if (text) return text;
        }
        if (isProfilePage()) {
            const activeTab = document.querySelector('.profile-section-tab.success_');
            const text = activeTab?.textContent?.trim();
            if (text) return text;
        }
        try {
            const title = document.title?.trim();
            if (title) return title;
        } catch { }
        return '';
    }

    function isItemDetailHref(href) {
        try {
            const u = new URL(href, location.origin);
            if (!u.pathname.includes('/item/')) return false;
            return !u.pathname.includes('/edit/');
        } catch {
            return false;
        }
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

    let profileRefreshInProgress = false;

    async function refreshProfileListing() {
        const section = getItem('profile_refresh_section');
        try {
            const resp = await fetch(location.href, {
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                cache: 'no-store'
            });
            if (!resp.ok) return;

            const html = await resp.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            if (isProfileSectionPage()) {
                const fresh = doc.querySelector('.profile-section-page');
                const current = document.querySelector('.profile-section-page');
                if (fresh && current) {
                    current.innerHTML = fresh.innerHTML;
                }
                return;
            }

            if (!section) return;
            const currentSection = document.getElementById('profile-section-' + section);
            const freshSection = doc.getElementById('profile-section-' + section);
            if (!currentSection || !freshSection) return;

            const currentContainer = currentSection.querySelector('[data-scroll-container]');
            const freshContainer = freshSection.querySelector('[data-scroll-container]');
            if (currentContainer && freshContainer) {
                const currentRow = currentContainer.querySelector('.row');
                const freshRow = freshContainer.querySelector('.row');
                if (currentRow && freshRow) {
                    currentRow.innerHTML = freshRow.innerHTML;
                }
            }

            if (freshSection.dataset?.count) {
                currentSection.dataset.count = freshSection.dataset.count;
            }
            currentSection.__updateControls?.();
        } catch { }
    }

    function maybeRefreshProfileListing() {
        if (!isProfilePage()) return false;
        const needsRefresh = getItem('profile_refresh_needed') === '1';
        const refreshDone = getItem('profile_refresh_done') === '1';

        if (needsRefresh && !refreshDone) {
            if (profileRefreshInProgress) return true;
            profileRefreshInProgress = true;
            setItem('profile_refresh_done', '1');
            refreshProfileListing().finally(() => {
                profileRefreshInProgress = false;
            });
            return true;
        }

        if (needsRefresh && refreshDone) {
            if (profileRefreshInProgress) return true;
            removeItem('profile_refresh_needed');
            removeItem('profile_refresh_done');
            removeItem('profile_refresh_section');
        }
        return false;
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

        let link = e.target.closest?.('a.item-link');
        if (!link) {
            const generic = e.target.closest?.('a[href]');
            if (generic && isItemDetailHref(generic.getAttribute('href') || '')) {
                link = generic;
            }
        }
        if (!link) return;

        const label = getListingLabel();
        if (label) setItem('listing_label', label);

        setItem('listing_url', location.pathname + location.search);
        setItem('listing_scroll', String(window.scrollY || 0));
        // Ensure slider restore is instant when returning from detail
        setItem('section_scroll_instant', '1');

        const itemId = link.dataset?.itemId;
        if (itemId) setItem('listing_anchor', 'item-' + itemId);

        const section = link.closest?.('[data-anchor]');
        if (section) {
            setItem('listing_section_anchor', section.dataset.anchor);
        }

        const activeTab = document.querySelector('.profile-section-tab.success_');
        if (activeTab?.dataset?.sectionTarget) {
            setItem('profile_active_tab', activeTab.dataset.sectionTarget);
        }

        try {
            setItem('profile_from_detail', '1');
        } catch { }

        try {
            const sectionId = section?.dataset?.anchor;
            const container = section?.matches?.('[data-scroll-container]')
                ? section
                : section?.querySelector?.('[data-scroll-container]');
            if (sectionId && container) {
                const row = container.querySelector('.row');
                const card = container.querySelector('.item-card');
                if (card) {
                    const styles = row ? window.getComputedStyle(row) : null;
                    const gap = styles ? parseFloat(styles.columnGap || styles.gap || '0') : 0;
                    const perView = window.matchMedia('(max-width: 768px)').matches ? 1 : 2;
                    const step = (card.getBoundingClientRect().width + (Number.isNaN(gap) ? 0 : gap)) * perView;
                    const index = step ? Math.round(container.scrollLeft / step) : 0;
                    setItem('section_scroll_index_' + sectionId, String(index));
                }
            }
        } catch { }
    }, { passive: true });

    /* =====================================================
       2) RESTORE SCROLL + HIGHLIGHT ON BACK
    ===================================================== */
    function restoreListingPosition() {
        if (maybeRefreshProfileListing()) return;
        if (!isAllowedPath(location.pathname + location.search)) {
            clearListing();
            return;
        }

        const savedUrl = getItem('listing_url');
        if (!savedUrl || savedUrl !== location.pathname + location.search) return;

        const anchorId = getItem('listing_anchor');
        const sectionAnchor = getItem('listing_section_anchor');
        const targetId = anchorId || sectionAnchor;
        const instant = getItem('listing_instant') === '1';
        const savedTab = getItem('profile_active_tab');

        const fromDetail = getItem('profile_from_detail') === '1';
        const instantSection = getItem('section_scroll_instant') === '1';
        if (savedTab && window.profileSectionsActivate && fromDetail) {
            try { window.profileSectionsActivate(savedTab, instantSection); } catch { }
            if (instantSection) {
                removeItem('section_scroll_instant');
            }
        }

        if (instant && fromDetail) {
            const savedScroll = parseInt(getItem('listing_scroll') || '0', 10);
            if (!Number.isNaN(savedScroll)) {
                window.scrollTo(0, savedScroll);
            }
            removeItem('listing_instant');
            return;
        }

        if (!targetId || !fromDetail) return;

        const el = document.getElementById(targetId);
        if (!el) return;

        const section = el.closest?.('.profile-section');
        if (section && window.profileSectionsActivate) {
            try { window.profileSectionsActivate(section.id); } catch { }
        }

        requestAnimationFrame(() => {
            const rect = el.getBoundingClientRect();

            const OFFSET = Math.min(
                window.innerHeight * 0.35, // 35% экрана
                420                        // но не больше 420px
            );

            if (Math.abs(rect.top) > OFFSET) {
                const targetTop = window.scrollY + rect.top - OFFSET;
                if (instant) {
                    window.scrollTo(0, targetTop);
                } else {
                    window.scrollBy({
                        top: rect.top - OFFSET,
                        behavior: 'smooth'
                    });
                }
            }

            if (anchorId && String(anchorId).startsWith('item-')) {
                el.classList.remove('back-highlight');
                void el.offsetWidth;
                el.classList.add('back-highlight');
            }
        });
    }

    window.addEventListener('pageshow', restoreListingPosition);
    document.addEventListener('DOMContentLoaded', restoreListingPosition);
    window.addEventListener('pageshow', () => { maybeRefreshProfileListing(); });
    document.addEventListener('DOMContentLoaded', () => { maybeRefreshProfileListing(); });

    function applyBackLabel() {
        if (document.getElementById('threadBackBtn')) return;
        const labelEl = document.getElementById('breadcrumbLabel');
        if (!labelEl) return;

        const sepEl = document.getElementById('breadcrumbSep');
        const storedLabel = (getItem('listing_label') || '').trim();
        const existingLabel = (labelEl.textContent || '').trim();
        const currentLabel = (getListingLabel() || '').trim();
        const label = isProfileSectionPage()
            ? currentLabel
            : (storedLabel || existingLabel);

        labelEl.textContent = label || '';
        if (sepEl) {
            sepEl.style.display = label ? '' : 'none';
        }

        if (isProfileSectionPage() && label) {
            setItem('listing_label', label);
        }
    }

    window.addEventListener('pageshow', applyBackLabel);
    document.addEventListener('DOMContentLoaded', applyBackLabel);

    if (isProfileSectionPage()) {
        const sectionId = getProfileSectionIdFromPath();
        if (sectionId) {
            setItem('profile_active_tab', sectionId);
            setItem('profile_from_detail', '1');
        }
    }

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

            if (isProfileSectionPage()) {
                const backUrl = getItem('profile_back_url');
                const backAnchor = getItem('profile_back_anchor');
                const sectionAnchor = getItem('listing_section_anchor');
                const activeTab = getItem('profile_active_tab');
                if (backUrl) {
                    setItem('listing_url', backUrl);
                    if (sectionAnchor) {
                        setItem('listing_anchor', sectionAnchor);
                    } else if (backAnchor) {
                        setItem('listing_anchor', backAnchor);
                    }
                    if (activeTab) {
                        setItem('profile_active_tab', activeTab);
                        setItem('profile_from_detail', '1');
                    }
                    setItem('listing_instant', '1');
                    location.href = backUrl;
                    return;
                }
            }

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
       4.1) PASS REDIRECT URL ON DELETE
    ===================================================== */
    document.addEventListener('submit', function (e) {
        const form = e.target;
        if (!form || !form.matches || !form.matches('form[data-delete-item]')) return;

        const redirectInput = form.querySelector('input.delete-redirect[name="redirect_to"]');
        if (!redirectInput) return;

        const listingUrl = getItem('listing_url');
        if (listingUrl) {
            redirectInput.value = listingUrl;
        }
    });

    /* =====================================================
       5) CLEAR LISTING WHEN LEAVING ALLOWED PAGES
    ===================================================== */
    document.addEventListener('click', function (e) {
        const a = e.target.closest?.('a[href]');
        if (!a) return;

        if (a.classList?.contains('item-link')) {
            return;
        }

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
            if (target.pathname.includes('/item/')) {
                return;
            }
            if (target.pathname.includes('/item/') && target.pathname.includes('/edit/')) {
                return;
            }
            if (isProfilePage() && !target.pathname.includes('/profile/')) {
                clearProfileListingState();
            }
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

        const url = new URL(location.href);
        const tab = url.searchParams.get('tab');

        let sectionFromPath = null;
        if (isProfileSectionPage()) {
            try {
                const parts = (location.pathname || '').split('/').filter(Boolean);
                if (parts.length >= 3 && parts[0] === 'profile') {
                    sectionFromPath = parts[2];
                }
            } catch { }
        }

        let changes = {};
        try {
            changes = JSON.parse(sessionStorage.getItem('listing_changes') || '{}');
        } catch {
            return;
        }

        const skipRemovedCheck = isProfileSectionPage();

        function removeCard(col, sectionEl, contextKey) {
            if (!skipRemovedCheck && contextKey
                && wasProfileRemoved(col.querySelector('.item_block')?.dataset?.itemId, contextKey)) {
                return false;
            }
            col.remove();
            if (sectionEl) {
                const n = parseInt(sectionEl.dataset.count || '0', 10);
                if (!Number.isNaN(n)) {
                    sectionEl.dataset.count = String(Math.max(0, n - 1));
                }
                sectionEl.__updateControls?.();
            }
            return true;
        }

        let removedCount = 0;
        document.querySelectorAll('.item_block[data-item-id]').forEach(card => {
            const itemId = card.dataset.itemId;
            if (!itemId || !changes[itemId]) return;

            const state = changes[itemId];
            const col = card.closest('.item-card');
            if (!col) return;

            const sectionEl = col.closest('.profile-section');
            const context = tab || sectionFromPath || sectionEl?.dataset?.section || null;

            if (context === 'liked' && state.liked === false) {
                if (removeCard(col, sectionEl, 'liked')) {
                    removedCount += 1;
                    if (!skipRemovedCheck) markProfileRemoval(itemId, 'liked');
                }
            }

            if (context === 'bookmarked' && state.bookmarked === false) {
                if (removeCard(col, sectionEl, 'bookmarked')) {
                    removedCount += 1;
                    if (!skipRemovedCheck) markProfileRemoval(itemId, 'bookmarked');
                }
            }
        });

        if (removedCount > 0 && tab) {
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
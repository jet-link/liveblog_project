// brainews_filter.js – Liked / Bookmarked filter for BraiNews, Search, Tag
(function () {
    'use strict';

    const FILTER_KEY = 'brainews_filter_active';
    const FILTER_STORAGE_KEY_PREFIX = 'brainews_original_cards_';
    let latestFilterRequestId = 0;

    function getFilterBaseUrl() {
        const block = document.querySelector('.filter-block[data-filter-url]');
        if (block?.dataset?.filterUrl) return block.dataset.filterUrl;
        const a = document.createElement('a');
        a.href = '/blog/brainews/filter/';
        return a.href;
    }

    function isFilterablePage() {
        const path = location.pathname.replace(/\/$/, '') || '/';
        if (path === '/blog/brainews' || path.endsWith('/brainews')) return true;
        if (path === '/search' || path.startsWith('/search/')) return true;
        if (path.includes('/blog/tag/')) return true;
        return false;
    }

    function isBraiNewsListing() {
        const path = location.pathname.replace(/\/$/, '') || '/';
        return path === '/blog/brainews' || path.endsWith('/brainews');
    }

    function getPageContextKey() {
        return location.pathname + location.search;
    }

    /** Merge search/tag context into filter API URL (Liked/Bookmarked on Search or Tag page). */
    function mergeFilterContextParams(u) {
        try {
            const cur = new URL(location.href);
            ['q', 'by_title', 'by_text', 'by_tags'].forEach(function (k) {
                const v = cur.searchParams.get(k);
                if (v != null && v !== '') u.searchParams.set(k, v);
            });
            const wrapper = document.getElementById('filterCardsWrapper');
            if (wrapper && wrapper.dataset && wrapper.dataset.tagSlug) {
                u.searchParams.set('tag_slug', wrapper.dataset.tagSlug);
            }
        } catch { /* ignore */ }
    }

    function getFilterUrl(filter) {
        const base = getFilterBaseUrl();
        try {
            const u = new URL(base, location.origin);
            u.searchParams.set('filter', filter);
            mergeFilterContextParams(u);
            u.searchParams.delete('page');
            return u.toString();
        } catch {
            return base + (base.includes('?') ? '&' : '?') + 'filter=' + encodeURIComponent(filter);
        }
    }

    function getBraiNewsUrl() {
        try {
            const a = document.querySelector('a[href*="/brainews"]');
            if (a) {
                const href = a.getAttribute('href');
                if (href && !href.includes('/item/')) {
                    const u = new URL(href, location.origin);
                    return u.origin + u.pathname.replace(/\/$/, '') + '/';
                }
            }
        } catch { }
        return location.origin + '/blog/brainews/';
    }

    function setItem(k, v) { try { sessionStorage.setItem(k, v); } catch { } }
    function getItem(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
    function removeItem(k) { try { sessionStorage.removeItem(k); } catch { } }
    const REFRESH_FLAG = 'brainews_filter_refresh_needed';
    function getRefreshFlag() { try { return localStorage.getItem(REFRESH_FLAG); } catch { return null; } }
    function clearRefreshFlag() { try { localStorage.removeItem(REFRESH_FLAG); } catch { } }

    function getFilterButtons() {
        return Array.from(document.querySelectorAll('.filter-block .filter-reason-btn'));
    }

    function getActiveFilter() {
        const btn = getFilterButtons().find(b => b.classList.contains('is-selected'));
        return btn ? btn.dataset.filter : null;
    }

    const FILTER_TITLES = { liked: 'Liked posts', bookmarked: 'Marked posts' };

    function setActiveFilter(value) {
        getFilterButtons().forEach(b => {
            b.classList.toggle('is-selected', b.dataset.filter === value);
        });
        const titleEl = document.getElementById('brainewsListingTitle');
        const ctxBlock = document.getElementById('filterPageContextBlock');
        if (titleEl) {
            titleEl.textContent = value ? (FILTER_TITLES[value] || 'BraiNews') : 'BraiNews';
            if (ctxBlock) {
                if (value) {
                    titleEl.classList.remove('d-none');
                    titleEl.removeAttribute('aria-hidden');
                } else {
                    titleEl.classList.add('d-none');
                    titleEl.setAttribute('aria-hidden', 'true');
                }
            }
        }
    }

    function showPagination(show) {
        document.querySelectorAll('#itemsListPaginationBar, #itemsListPagination, #showMoreWrapper').forEach(el => {
            if (el) el.style.display = show ? '' : 'none';
        });
        const ctxBlock = document.getElementById('filterPageContextBlock');
        const titleEl = document.getElementById('brainewsListingTitle');
        if (ctxBlock) {
            if (show) {
                ctxBlock.style.display = '';
                requestAnimationFrame(function () {
                    ctxBlock.classList.remove('filter-context-hidden');
                });
                if (titleEl) {
                    titleEl.classList.add('d-none');
                    titleEl.setAttribute('aria-hidden', 'true');
                }
            } else {
                ctxBlock.classList.add('filter-context-hidden');
                setTimeout(function () { ctxBlock.style.display = 'none'; }, 350);
            }
        }
    }

    function showEmptyHint(msg) {
        const hint = document.getElementById('filterEmptyHint');
        if (!hint) return;
        if (msg) {
            hint.textContent = msg;
            hint.classList.remove('hidden');
        } else {
            hint.textContent = '';
            hint.classList.add('hidden');
        }
    }

    async function fetchFiltered(filter) {
        const url = getFilterUrl(filter);
        const resp = await fetch(url, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            cache: 'no-store'
        });
        if (!resp.ok) throw new Error('Filter fetch failed');
        return resp.text();
    }

    function replaceCardsWith(html) {
        const wrapper = document.getElementById('filterCardsWrapper');
        if (!wrapper) return;
        wrapper.classList.add('filter-cards-fade-out');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                wrapper.innerHTML = html;
                wrapper.classList.remove('filter-cards-fade-out');
                wrapper.classList.add('filter-cards-fade-in');
                wrapper.offsetHeight; // reflow
                wrapper.classList.remove('filter-cards-fade-in');
                if (window.initFilterCardsPagination) window.initFilterCardsPagination();
            });
        });
    }

    function saveOriginalContent() {
        const wrapper = document.getElementById('filterCardsWrapper');
        if (!wrapper || wrapper.dataset.brainewsOriginalSaved === '1') return;
        try {
            const key = FILTER_STORAGE_KEY_PREFIX + getPageContextKey();
            sessionStorage.setItem(key, wrapper.innerHTML);
            wrapper.dataset.brainewsOriginalSaved = '1';
        } catch { }
    }

    function restoreOriginalContent() {
        const wrapper = document.getElementById('filterCardsWrapper');
        const key = FILTER_STORAGE_KEY_PREFIX + getPageContextKey();
        const saved = sessionStorage.getItem(key);
        if (!wrapper) return;
        if (!saved) {
            removeItem(key);
            if (wrapper.dataset) wrapper.dataset.brainewsOriginalSaved = '';
            showPagination(true);
            return;
        }
        wrapper.classList.add('filter-cards-fade-out');
        const transitionMs = 200;
        requestAnimationFrame(function () {
            setTimeout(function () {
                showPagination(true);
                wrapper.innerHTML = saved;
                removeItem(key);
                if (wrapper.dataset) wrapper.dataset.brainewsOriginalSaved = '';
                wrapper.classList.remove('filter-cards-fade-out');
                wrapper.classList.add('filter-cards-fade-in');
                wrapper.offsetHeight;
                wrapper.classList.remove('filter-cards-fade-in');
                if (window.applyListingChanges) window.applyListingChanges();
                if (window.initFilterCardsPagination) window.initFilterCardsPagination();
            }, transitionMs);
        });
    }

    function applyFilter(filter) {
        if (!filter) {
            latestFilterRequestId++;
            clearRefreshFlag();
            setActiveFilter(null);
            removeItem(FILTER_KEY);
            if (isBraiNewsListing()) {
                restoreOriginalContent();
                showEmptyHint('');
            } else {
                window.location.href = getBraiNewsUrl();
            }
            return;
        }
        latestFilterRequestId++;
        const myReqId = latestFilterRequestId;
        saveOriginalContent();
        setActiveFilter(filter);
        setItem(FILTER_KEY, filter);
        showPagination(false);

        fetchFiltered(filter).then(html => {
            if (myReqId !== latestFilterRequestId) return;
            replaceCardsWith(html);
            showPagination(false);
            const emptyEl = document.querySelector('.filter-empty-message');
            if (emptyEl) {
                showEmptyHint(emptyEl.textContent);
            } else {
                showEmptyHint('');
            }
            if (window.applyListingChanges) window.applyListingChanges();
        }).catch(() => {
            if (myReqId !== latestFilterRequestId) return;
            showEmptyHint('Failed to load filter');
        });
    }

    function removeInvalidFilterCards() {
        if (!isFilterablePage()) return;
        const active = getItem(FILTER_KEY);
        if (!active || (active !== 'liked' && active !== 'bookmarked')) return;

        let changes = {};
        try {
            changes = JSON.parse(sessionStorage.getItem('listing_changes') || '{}');
        } catch { return }

        document.querySelectorAll('.filter-cards-wrapper .item_block[data-item-id], #filterCardsWrapper .item_block[data-item-id]').forEach(card => {
            const itemId = card.dataset.itemId;
            if (!itemId || !changes[itemId]) return;
            const state = changes[itemId];
            const col = card.closest('.item-card');
            if (!col) return;

            if (active === 'liked' && state.liked === false) {
                col.remove();
            }
            if (active === 'bookmarked' && state.bookmarked === false) {
                col.remove();
            }
        });
    }

    function onFilterChange(e) {
        const btn = e.target.closest('.filter-reason-btn');
        if (!btn) return;
        if (!isFilterablePage()) return;

        const value = btn.dataset.filter;
        const wasSelected = btn.classList.contains('is-selected');
        getFilterButtons().forEach(b => b.classList.remove('is-selected'));
        if (wasSelected) {
            applyFilter(null);
        } else {
            btn.classList.add('is-selected');
            applyFilter(value);
        }
    }

    document.addEventListener('click', onFilterChange);
    document.addEventListener('click', function (e) {
        const a = e.target.closest('a[href]');
        if (!a) return;
        try {
            const u = new URL(a.getAttribute('href') || '', location.origin);
            const path = u.pathname.replace(/\/$/, '') || '/';
            const targetPath = path + (u.search || '');
            const currentPath = getPageContextKey();
            if (targetPath !== currentPath && !u.searchParams.get('filter')) {
                removeItem(FILTER_KEY);
            }
        } catch { }
    }, { passive: true });

    function restoreFilterOnReturnForPage() {
        const active = getItem(FILTER_KEY);
        if (!active) return;
        latestFilterRequestId++;
        const myReqId = latestFilterRequestId;
        clearRefreshFlag();
        saveOriginalContent();
        setActiveFilter(active);
        showPagination(false);
        fetchFiltered(active).then(html => {
            if (myReqId !== latestFilterRequestId) return;
            replaceCardsWith(html);
            showPagination(false);
            const emptyEl = document.querySelector('.filter-empty-message');
            if (emptyEl) {
                showEmptyHint(emptyEl.textContent);
            } else {
                showEmptyHint('');
            }
            if (window.applyListingChanges) window.applyListingChanges();
        }).catch(() => {
            if (myReqId !== latestFilterRequestId) return;
            applyFilter(null);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        const block = document.querySelector('.filter-block');
        if (!block) return;
        if (!isFilterablePage()) {
            block.style.display = 'none';
            return;
        }
        const active = getItem(FILTER_KEY);
        if (active) {
            restoreFilterOnReturnForPage();
        }
    });

    window.addEventListener('pageshow', function (e) {
        if (!e.persisted) {
            if (isFilterablePage()) {
                const active = getItem(FILTER_KEY);
                if (active) restoreFilterOnReturnForPage();
                else removeInvalidFilterCards();
            }
            return;
        }
        if (isFilterablePage()) {
            refreshFilterIfNeeded();
            removeInvalidFilterCards();
        }
    });

    window.addEventListener('pageshow', function () {
        if (isFilterablePage()) removeInvalidFilterCards();
    });

    document.addEventListener('DOMContentLoaded', removeInvalidFilterCards);

    function refreshFilterIfNeeded() {
        if (!isFilterablePage()) return;
        const active = getItem(FILTER_KEY);
        if (active !== 'liked' && active !== 'bookmarked') return;
        if (getRefreshFlag() !== '1') return;
        clearRefreshFlag();
        latestFilterRequestId++;
        const myReqId = latestFilterRequestId;
        setActiveFilter(active);
        showPagination(false);
        fetchFiltered(active).then(html => {
            if (myReqId !== latestFilterRequestId) return;
            replaceCardsWith(html);
            showPagination(false);
            const emptyEl = document.querySelector('.filter-empty-message');
            if (emptyEl) {
                showEmptyHint(emptyEl.textContent);
            } else {
                showEmptyHint('');
            }
            if (window.applyListingChanges) window.applyListingChanges();
        }).catch(() => {});
    }

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            refreshFilterIfNeeded();
        }
    });

    window.addEventListener('focus', refreshFilterIfNeeded);

    window.addEventListener('storage', function (e) {
        if (e.key === REFRESH_FLAG && e.newValue === '1') {
            refreshFilterIfNeeded();
        }
    });

    document.addEventListener('brainews-filter-refresh', function () {
        removeInvalidFilterCards();
        refreshFilterIfNeeded();
    });

    /* Server-paginated filter: load next page of Liked/Bookmarked cards */
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.filter-load-more-btn');
        if (!btn || !document.body.contains(btn)) return;
        if (!btn.closest('.filter-cards-wrapper')) return;
        e.preventDefault();
        const active = getActiveFilter();
        if (!active) return;
        const row = document.querySelector('.filter-cards-wrapper .filter-cards-row');
        const footer = btn.closest('.filter-load-more-wrap');
        if (!row || !footer) return;
        const nextPage = btn.dataset.nextPage;
        if (!nextPage) return;
        const u = new URL(getFilterBaseUrl(), location.origin);
        u.searchParams.set('filter', active);
        mergeFilterContextParams(u);
        u.searchParams.set('page', nextPage);
        u.searchParams.set('append', '1');
        btn.disabled = true;
        fetch(u.toString(), {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            cache: 'no-store'
        })
            .then(function (resp) {
                if (!resp.ok) throw new Error('load more failed');
                return resp.text();
            })
            .then(function (html) {
                footer.remove();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const chunk = doc.querySelector('.filter-append-chunk');
                if (!chunk) return;
                const newFooter = chunk.querySelector('.filter-load-more-wrap');
                if (newFooter) newFooter.remove();
                while (chunk.firstChild) {
                    row.appendChild(chunk.firstChild);
                }
                if (newFooter) {
                    const wrap = row.closest('.filter-cards-wrapper');
                    if (wrap) wrap.appendChild(newFooter);
                }
                if (window.applyListingChanges) window.applyListingChanges();
            })
            .catch(function () {
                btn.disabled = false;
            });
    });

})();

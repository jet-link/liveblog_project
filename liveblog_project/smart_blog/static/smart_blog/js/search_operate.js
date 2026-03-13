// static/js/search_field.js
document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    let __searchOverlayOpen = false;

    const __searchPrevOverflow = {
        html: '',
        body: '',
        paddingRight: ''
    };

    // helpers
    function $(sel, ctx) { try { return (ctx || document).querySelector(sel); } catch (e) { return null; } }
    function $$(sel, ctx) { try { return Array.from((ctx || document).querySelectorAll(sel)); } catch (e) { return []; } }
    function getSearchReturnUrl() {
        var path = location.pathname;
        var m = path.match(/^(\/blog\/item\/[^/]+)\/edit\/?$/);
        if (m) return m[1] + '/';
        return path + location.search;
    }

    const originalInner = document.querySelector('.header-search-inner');
    const floatingBtn = document.getElementById('floatingSearchBtn');
    const overlayRoot = document.getElementById('overlaySearchRoot');
    const overlayBackdrop = document.getElementById('overlaySearchBackdrop');
    const overlayContent = document.getElementById('overlaySearchContent');
    const overlayCloseBtn = document.getElementById('overlayCloseBtn');

    // ------------- Clear button logic (works for any container) -------------
    function attachClearButtons(container) {
        // find buttons with data-target inside container OR .field-clear
        const btns = (container ? $$('.field-clear', container) : $$('.field-clear'));

        btns.forEach(btn => {
            // skip if already bound
            if (btn.__clearBound) return;
            btn.__clearBound = true;

            const dataTarget = btn.getAttribute('data-target');
            let target = null;

            if (dataTarget) target = document.querySelector(dataTarget);
            if (!target && container) {
                // try to find nearest input within same container (e.g. cloned)
                const parent = btn.closest('.header-search-row, form, .input-group, .form-floating');
                if (parent) target = parent.querySelector('input, textarea');
            }
            if (!target) {
                // fallback: global #headerSearchInput
                target = document.getElementById('headerSearchInput');
            }

            if (!target) { btn.classList.add('hidden'); return; }

            function updateVisibility() {
                const v = (target.value || '').trim();
                if (v.length) btn.classList.remove('hidden'); else btn.classList.add('hidden');
            }

            btn.addEventListener('click', function (e) {
                e.preventDefault();
                target.value = '';
                target.focus();
                try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch (err) { }
                updateVisibility();
            });

            // observe input in case target changes (typing)
            target.addEventListener('input', updateVisibility);
            // initial
            updateVisibility();
        });
    }

    // attach for original page (top)
    attachClearButtons(document);

    // ------------- show floating button when original leaves viewport -------------
    if (originalInner && floatingBtn) {
        // ensure initial state is hidden (no .visible)
        floatingBtn.classList.remove('visible');

        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // original is visible -> hide floating button
                    floatingBtn.classList.remove('visible');
                } else {
                    // original left viewport -> show floating button with animation
                    // small timeout to ensure smoothness if needed
                    requestAnimationFrame(() => floatingBtn.classList.add('visible'));
                }
            });
        }, { threshold: 0.12 });

        io.observe(originalInner);
    }

    // ------------- sticky search bar: липнет при скролле вниз, возвращается на место при скролле вверх -------------
    // Отключено для search в header dropdown — не создаём placeholder/offset при скролле
    (function initStickySearchBar() {
        const searchOverlay = document.getElementById('headerSearchOverlay');
        if (!searchOverlay || searchOverlay.closest('#overlaySearchRoot') || searchOverlay.closest('#headerSearchDropdown')) return;

        let placeholder = null;
        let stickThreshold = 0;
        let rafId = null;
        let lastScrollY = -1;

        function updateStickThreshold() {
            if (!searchOverlay.classList.contains('header-search-stuck')) {
                var rect = searchOverlay.getBoundingClientRect();
                stickThreshold = rect.top + (window.scrollY || window.pageYOffset);
            }
        }

        function updateStuckState() {
            var scrollY = window.scrollY || window.pageYOffset;
            if (scrollY > stickThreshold) {
                if (!searchOverlay.classList.contains('header-search-stuck')) {
                    var rect = searchOverlay.getBoundingClientRect();
                    if (!placeholder) {
                        placeholder = document.createElement('div');
                        placeholder.className = 'header-search-placeholder';
                        searchOverlay.parentNode.insertBefore(placeholder, searchOverlay);
                    }
                    placeholder.style.height = rect.height + 'px';
                    placeholder.style.display = 'block';
                    searchOverlay.style.setProperty('--stuck-left', rect.left + 'px');
                    searchOverlay.style.setProperty('--stuck-width', rect.width + 'px');
                    searchOverlay.classList.add('header-search-stuck');
                }
            } else {
                if (searchOverlay.classList.contains('header-search-stuck')) {
                    searchOverlay.classList.remove('header-search-stuck');
                    searchOverlay.style.removeProperty('--stuck-left');
                    searchOverlay.style.removeProperty('--stuck-width');
                    if (placeholder) placeholder.style.display = 'none';
                }
                updateStickThreshold();
            }
            lastScrollY = scrollY;
        }

        function onScroll() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(function () {
                rafId = null;
                updateStuckState();
            });
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', function () {
            updateStickThreshold();
            if (searchOverlay.classList.contains('header-search-stuck') && placeholder) {
                placeholder.style.display = 'none';
                searchOverlay.classList.remove('header-search-stuck');
                requestAnimationFrame(function () {
                    updateStickThreshold();
                    var rect = searchOverlay.getBoundingClientRect();
                    placeholder.style.height = rect.height + 'px';
                    searchOverlay.style.setProperty('--stuck-left', rect.left + 'px');
                    searchOverlay.style.setProperty('--stuck-width', rect.width + 'px');
                    searchOverlay.classList.add('header-search-stuck');
                    placeholder.style.display = 'block';
                });
            }
        });

        window.addEventListener('pageshow', function (e) {
            if (e.persisted) {
                lastScrollY = -1;
                if (searchOverlay.classList.contains('header-search-stuck')) {
                    searchOverlay.classList.remove('header-search-stuck');
                    searchOverlay.style.removeProperty('--stuck-left');
                    searchOverlay.style.removeProperty('--stuck-width');
                    if (placeholder) placeholder.style.display = 'none';
                }
                setTimeout(function () {
                    updateStickThreshold();
                    updateStuckState();
                }, 150);
            }
        });

        setTimeout(function () {
            updateStickThreshold();
            updateStuckState();
        }, 200);
    })();

    // ------------- overlay open/close, cloning with unique IDs -------------
    function makeUniqueClone(srcEl) {
        // deep clone
        const clone = srcEl.cloneNode(true);

        // generate suffix
        const suffix = '-' + Math.random().toString(36).slice(2, 8);

        // update ids and label[for] within clone to avoid collisions
        // elements with id -> add suffix, labels 'for' attribute updated
        clone.querySelectorAll('[id]').forEach(el => {
            const oldId = el.id;
            const newId = oldId + suffix;
            el.id = newId;
            // if this element is a label target (some labels use for), find and update
            clone.querySelectorAll('label[for="' + oldId + '"]').forEach(lbl => {
                lbl.setAttribute('for', newId);
            });
        });

        // also update any label[for] that referenced original ids not in clone (defensive)
        clone.querySelectorAll('label').forEach(lbl => {
            const f = lbl.getAttribute('for');
            if (f && !clone.querySelector('#' + f)) {
                // try find an element inside clone where name == f and adjust (rare)
            }
        });

        return clone;
    }

    var OVERLAY_HISTORY_MAX = 25;
    var OVERLAY_TRUNCATE_LEN = 42;
    var SEARCH_MAX_CHARS = 150;
    var SEARCH_MAX_WORDS = 15;
    var SEARCH_MIN_CHARS = 2;

    function normalizeSearchQuery(raw) {
        if (!raw || typeof raw !== 'string') return { ok: false, reason: 'too_short' };
        var s = raw.trim();
        if (!s) return { ok: false, reason: 'too_short' };
        s = s.replace(/\s+/g, ' ');
        s = s.replace(/[^\p{L}\p{N}\s\-'",.!?]/gu, ' ').replace(/\s+/g, ' ').trim();
        s = s.replace(/\b(site|filetype|intitle|inurl):\s*[\S]+/gi, '').replace(/\s+/g, ' ').trim();
        s = s.replace(/\b(AND|OR|NOT)\b/gi, ' ').replace(/\s+/g, ' ').trim();
        if (s.length > SEARCH_MAX_CHARS) s = s.slice(0, SEARCH_MAX_CHARS).trim();
        var words = s.split(/\s+/).filter(Boolean);
        if (words.length > SEARCH_MAX_WORDS) words = words.slice(0, SEARCH_MAX_WORDS);
        s = words.join(' ');
        if (s.length < SEARCH_MIN_CHARS) return { ok: false, reason: 'too_short' };
        return { ok: true, query: s };
    }

    function buildSearchUrlForItem(item) {
        var params = new URLSearchParams();
        params.set('q', item.search_query || '');
        var f = item.search_filters || {};
        if (f.by_title) params.set('by_title', '1');
        if (f.by_text) params.set('by_text', '1');
        if (f.by_tags) params.set('by_tags', '1');
        if (!f.by_title && !f.by_text && !f.by_tags) {
            params.set('by_title', '1'); params.set('by_text', '1'); params.set('by_tags', '1');
        }
        return (window.SEARCH_URL || '/search/') + '?' + params.toString();
    }

    function truncateQuery(q) {
        if (!q || typeof q !== 'string') return '';
        var s = q.trim();
        if (s.length <= OVERLAY_TRUNCATE_LEN) return s;
        return s.slice(0, OVERLAY_TRUNCATE_LEN) + '…';
    }

    function initOverlayHistory(container) {
        var block = document.querySelector('[data-search-history-url]');
        if (!block) return;
        var isAuth = (block.getAttribute('data-user-authenticated') || '').trim() === '1';
        var listUrl = block.getAttribute('data-search-history-url');
        var clickedPattern = block.getAttribute('data-search-history-clicked-pattern');
        var clearUrl = block.getAttribute('data-search-history-clear-url');

        var wrap = document.createElement('div');
        wrap.className = 'overlay-history-block';
        var grid = document.createElement('div');
        grid.className = 'overlay-history-grid';
        var clearWrap = document.createElement('div');
        clearWrap.className = 'overlay-history-clear-wrap';
        if (!isAuth) clearWrap.style.display = 'none';
        if (isAuth) {
            var clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'overlay-history-clear-btn';
            clearBtn.textContent = 'Clear history';
            clearBtn.setAttribute('aria-label', 'Clear search history');
            clearWrap.appendChild(clearBtn);
        }
        wrap.appendChild(grid);
        wrap.appendChild(clearWrap);
        container.appendChild(wrap);

        function getCSRF() {
            var m = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
            return m ? m[2] : '';
        }

        function escapeHtml(s) {
            if (!s) return '';
            var d = document.createElement('div');
            d.textContent = s;
            return d.innerHTML;
        }

        function renderItems(items) {
            grid.innerHTML = '';
            if (isAuth) clearWrap.style.display = '';
            if (!items || items.length === 0) {
                grid.innerHTML = '<span class="overlay-history-empty">No recent requests!</span>';
                if (isAuth) clearWrap.style.display = 'none';
                return;
            }
            items.slice(0, OVERLAY_HISTORY_MAX).forEach(function (item, idx) {
                var q = item.search_query || '';
                var display = truncateQuery(q);
                var badge = document.createElement('button');
                badge.type = 'button';
                badge.className = 'overlay-history-badge custom_badge badge_primary';
                badge.textContent = display;
                badge.dataset.url = buildSearchUrlForItem(item);
                badge.dataset.id = item.id;
                badge.dataset.searchQuery = q;
                badge.dataset.searchFilters = JSON.stringify(item.search_filters || {});
                badge.dataset.guestIndex = isAuth ? '' : idx;
                grid.appendChild(badge);
            });
        }

        function loadHistory() {
            if (isAuth && listUrl) {
                fetch(listUrl, { credentials: 'same-origin' })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        renderItems(data.items || []);
                    })
                    .catch(function () { renderItems([]); });
            } else if (typeof window.getGuestSearchHistory === 'function') {
                renderItems(window.getGuestSearchHistory(OVERLAY_HISTORY_MAX));
            } else {
                renderItems([]);
            }
        }

        grid.addEventListener('click', function (e) {
            var badge = e.target.closest('.overlay-history-badge');
            if (!badge) return;
            e.preventDefault();
            var url = badge.dataset.url;
            var sep = (url || '').indexOf('?') >= 0 ? '&' : '?';
            var fullUrl = (url || '') + sep + 'from_history=1';
            if (!isAuth && typeof window.bumpGuestSearchToTop === 'function') {
                try {
                    var q = badge.dataset.searchQuery;
                    var f = {};
                    try { f = JSON.parse(badge.dataset.searchFilters || '{}'); } catch (x) { }
                    window.bumpGuestSearchToTop(q, f);
                } catch (err) { }
            }
            try {
                sessionStorage.setItem('search_clear_next', '1');
                sessionStorage.removeItem('brainews_filter_active');
                sessionStorage.setItem('search_return_url', getSearchReturnUrl());
            } catch (err) { }
            if (isAuth && clickedPattern && badge.dataset.id) {
                var clickedUrl = clickedPattern.replace('999999', badge.dataset.id);
                fetch(clickedUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'X-CSRFToken': getCSRF(),
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    }
                }).catch(function () { });
            }
            closeOverlay(function () {
                window.location.href = fullUrl;
            }, { skipAnimation: true });
        });

        if (isAuth) {
            var overlayClearBtn = clearWrap.querySelector('.overlay-history-clear-btn');
            if (overlayClearBtn) {
                overlayClearBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (clearUrl) {
                        fetch(clearUrl, {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'X-CSRFToken': getCSRF(),
                                'X-Requested-With': 'XMLHttpRequest'
                            }
                        }).then(function () { renderItems([]); }).catch(function () { });
                    }
                });
            }
        }

        loadHistory();
    }

    function openOverlay() {
        if (!overlayRoot || __searchOverlayOpen) return;
        __searchOverlayOpen = true;

        overlayContent.innerHTML = '';
        const clone = makeUniqueClone(originalInner);
        // 🔧 FIX: обновляем data-target у clear-кнопок в clone
        clone.querySelectorAll('.field-clear[data-target]').forEach(btn => {
            const input = btn.closest('.header-search-row')
                ?.querySelector('input, textarea');

            if (input && input.id) {
                btn.setAttribute('data-target', '#' + input.id);
                btn.classList.remove('hidden'); // 👈 разрешаем JS управлять
            }
        });
        
        overlayContent.appendChild(clone);
        attachClearButtons(overlayContent);
        initOverlayHistory(overlayContent);

        overlayRoot.classList.remove('hidden');
        overlayRoot.removeAttribute('inert');
        overlayRoot.classList.add('overlay-from-bottom');
        overlayRoot.setAttribute('aria-hidden', 'false');

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                overlayRoot.classList.remove('overlay-from-bottom');
            });
        });

        // 🔒 СОХРАНЯЕМ ОДИН РАЗ
        __searchPrevOverflow.html = document.documentElement.style.overflow;
        __searchPrevOverflow.body = document.body.style.overflow;
        __searchPrevOverflow.paddingRight = document.body.style.paddingRight;

        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = '0px';

        const input = overlayContent.querySelector('input, textarea');
        input?.focus();

        bindOverlaySubmitHandlers(overlayContent);

    }

    function closeOverlay(onAfterAnimation, options) {
        if (!overlayRoot || !__searchOverlayOpen) return;

        var done = false;
        function doClose() {
            if (done) return;
            done = true;
            __searchOverlayOpen = false;
            overlayRoot.classList.remove('overlay-sliding-down');
            /* inert first: browser moves focus out, prevents aria-hidden warning */
            overlayRoot.setAttribute('inert', '');
            requestAnimationFrame(function () {
                overlayRoot.classList.add('hidden');
                overlayContent.innerHTML = '';
                overlayRoot.setAttribute('aria-hidden', 'true');
                overlayRoot.removeAttribute('inert');
                document.documentElement.style.overflow = __searchPrevOverflow.html || '';
                document.body.style.overflow = __searchPrevOverflow.body || '';
                document.body.style.paddingRight = __searchPrevOverflow.paddingRight || '';
                if (typeof onAfterAnimation === 'function') onAfterAnimation();
            });
        }

        if (options && options.skipAnimation) {
            doClose();
        } else {
            overlayRoot.classList.add('overlay-sliding-down');
            overlayRoot.addEventListener('transitionend', function handler(e) {
                if (e.target !== overlayRoot || e.propertyName !== 'transform') return;
                overlayRoot.removeEventListener('transitionend', handler);
                doClose();
            }, { once: true });
            setTimeout(doClose, 420);
        }
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && __searchOverlayOpen) {
            e.preventDefault();
            closeOverlay();
        }
    });

    // ------------- overlay submit (Enter) -------------
    function bindOverlaySubmitHandlers(container) {
        if (!container) return;
        // input element inside container
        const inputEl = container.querySelector('input[type="search"], input[type="text"], textarea');
        const chkTitle = container.querySelector('input[name="by_title"]');
        const chkText = container.querySelector('input[name="by_text"]');
        const chkTags = container.querySelector('input[name="by_tags"]');

        function onEnter(e) {
            if (e.key !== 'Enter' || e.shiftKey) return;
            e.preventDefault();
            var raw = (inputEl && inputEl.value || '').trim();
            if (!raw) return;
            var norm = normalizeSearchQuery(raw);
            if (!norm.ok) return;
            const q = norm.query;
            const params = new URLSearchParams();
            params.set('q', q);
            if (chkTitle && chkTitle.checked) params.set('by_title', '1');
            if (chkText && chkText.checked) params.set('by_text', '1');
            if (chkTags && chkTags.checked) params.set('by_tags', '1');
            if (!((chkTitle && chkTitle.checked) || (chkText && chkText.checked) || (chkTags && chkTags.checked))) {
                params.set('by_title', '1'); params.set('by_text', '1'); params.set('by_tags', '1');
            }
            try {
                sessionStorage.removeItem('brainews_filter_active');
                sessionStorage.setItem('search_return_url', getSearchReturnUrl());
            } catch (err) { }
            if (typeof window.saveGuestSearchHistory === 'function') {
                var hasAny = (chkTitle && chkTitle.checked) || (chkText && chkText.checked) || (chkTags && chkTags.checked);
                window.saveGuestSearchHistory(q, {
                    by_title: hasAny ? !!(chkTitle && chkTitle.checked) : true,
                    by_text: hasAny ? !!(chkText && chkText.checked) : true,
                    by_tags: hasAny ? !!(chkTags && chkTags.checked) : true
                });
            }
            closeOverlay(function () {
                window.location.href = '/search/?' + params.toString();
            }, { skipAnimation: true });
        }

        if (inputEl) {
            inputEl.removeEventListener('keydown', onEnter);
            inputEl.addEventListener('keydown', onEnter);
        }
    }

    // ------------- wire events -------------
    if (floatingBtn) {
        floatingBtn.addEventListener('click', openOverlay);
    }
    if (overlayCloseBtn) overlayCloseBtn.addEventListener('click', closeOverlay);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlayRoot && !overlayRoot.classList.contains('hidden')) {
            closeOverlay();
        }
    });

    // attach clear for initial document (original top form)
    attachClearButtons(document);

    // --- keep original top input Enter behaviour (like before) ---
    (function attachOriginalEnter() {
        const headerInput = document.getElementById('headerSearchInput');
        if (!headerInput) return;
        const chkTitle = document.getElementById('searchByTitle');
        const chkText = document.getElementById('searchByText');
        const chkTags = document.getElementById('searchByTags');

        headerInput.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            var raw = (headerInput.value || '').trim();
            if (!raw) return;
            var norm = normalizeSearchQuery(raw);
            if (!norm.ok) return;
            const q = norm.query;
            const params = new URLSearchParams();
            params.set('q', q);

            if (chkTitle && chkTitle.checked) params.set('by_title', '1');
            if (chkText && chkText.checked) params.set('by_text', '1');
            if (chkTags && chkTags.checked) params.set('by_tags', '1');

            if (!((chkTitle && chkTitle.checked) || (chkText && chkText.checked) || (chkTags && chkTags.checked))) {
                params.set('by_title', '1'); params.set('by_text', '1'); params.set('by_tags', '1');
            }

            try {
                sessionStorage.setItem('search_clear_next', '1');
                sessionStorage.removeItem('brainews_filter_active');
                sessionStorage.setItem('search_return_url', getSearchReturnUrl());
            } catch (e) { }
            if (typeof window.saveGuestSearchHistory === 'function') {
                var hasAny = (chkTitle && chkTitle.checked) || (chkText && chkText.checked) || (chkTags && chkTags.checked);
                window.saveGuestSearchHistory(q, {
                    by_title: hasAny ? !!(chkTitle && chkTitle.checked) : true,
                    by_text: hasAny ? !!(chkText && chkText.checked) : true,
                    by_tags: hasAny ? !!(chkTags && chkTags.checked) : true
                });
            }
            headerInput.value = '';
            const hsClear = document.getElementById('headerSearchClear');
            if (hsClear) hsClear.classList.add('hidden');

            window.location.href = '/search/?' + params.toString();
        });
    })();

    // --- clear header search when leaving BraiNews ---
    (function handleBraiNewsLeave() {
        const headerInput = document.getElementById('headerSearchInput');
        if (!headerInput) return;
        const isBraiNews = location.pathname.includes('/brainews');
        if (!isBraiNews) return;

        function markClearOnLeave() {
            const val = (headerInput.value || '').trim();
            if (!val) return;
            try { sessionStorage.setItem('clear_header_search', '1'); } catch { }
        }

        window.addEventListener('pagehide', markClearOnLeave);
        window.addEventListener('pageshow', () => {
            try {
                if (sessionStorage.getItem('clear_header_search') === '1') {
                    sessionStorage.removeItem('clear_header_search');
                    headerInput.value = '';
                    const hsClear = document.getElementById('headerSearchClear');
                    if (hsClear) hsClear.classList.add('hidden');
                }
            } catch { }
        });
    })();

    // --- Search history dropdown (BraiNews, search_results, tag_items_list) ---
    (function initSearchHistory() {
        const block = document.querySelector('[data-search-history-url], [data-user-authenticated]');
        if (!block) return;
        const headerInput = document.getElementById('headerSearchInput');
        const dropdown = document.getElementById('searchHistoryDropdown');
        if (!headerInput || !dropdown) return;

        const isAuth = (block.getAttribute('data-user-authenticated') || '').trim() === '1';
        const listUrl = block.getAttribute('data-search-history-url');
        const clickedPattern = block.getAttribute('data-search-history-clicked-pattern');
        const deletePattern = block.getAttribute('data-search-history-delete-pattern');
        const clearUrl = block.getAttribute('data-search-history-clear-url');
        if (isAuth && (!listUrl || !clickedPattern)) return;

        var GUEST_STORAGE_KEY = 'brainews_search_history';
        var GUEST_MAX_ITEMS = 10;
        var GUEST_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

        function getCSRF() {
            const m = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
            return m ? m[2] : '';
        }

        function buildSearchUrl(item) {
            const params = new URLSearchParams();
            params.set('q', item.search_query);
            const f = item.search_filters || {};
            if (f.by_title) params.set('by_title', '1');
            if (f.by_text) params.set('by_text', '1');
            if (f.by_tags) params.set('by_tags', '1');
            if (!f.by_title && !f.by_text && !f.by_tags) {
                params.set('by_title', '1'); params.set('by_text', '1'); params.set('by_tags', '1');
            }
            return (window.SEARCH_URL || '/search/') + '?' + params.toString();
        }

        function formatMeta(item) {
            const parts = [];
            if (item.results_count != null) parts.push(item.results_count + ' found');
            if (item.created_at) {
                const d = new Date(item.created_at);
                const now = new Date();
                const diff = Math.floor((now - d) / 86400000);
                if (diff === 0) parts.push('Today');
                else if (diff === 1) parts.push('Yesterday');
                else if (diff <= 5) parts.push(diff + ' days ago');
                else parts.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }));
            }
            return parts.join(' · ');
        }

        var cachedHistory = [];

        function showHistory(items, isEmptyFilter) {
            dropdown.innerHTML = '';
            if (!items || items.length === 0) {
                dropdown.innerHTML = '<div class="search-history-empty">' + (isEmptyFilter ? 'No matching requests...' : 'No recent requests...') + '</div>';
            } else {
                var headerRow = document.createElement('div');
                headerRow.className = 'search-history-header-row';
                headerRow.innerHTML = '<span class="search-history-header">Search history</span>';
                if (isAuth) {
                    var clearBtn = document.createElement('button');
                    clearBtn.type = 'button';
                    clearBtn.className = 'search-history-clear-btn';
                    clearBtn.textContent = 'Clear history';
                    clearBtn.setAttribute('aria-label', 'Clear search history');
                    headerRow.appendChild(clearBtn);
                }
                dropdown.appendChild(headerRow);
                items.forEach(function (item, idx) {
                    const row = document.createElement('div');
                    row.className = 'search-history-item';
                    row.dataset.id = item.id;
                    row.dataset.url = buildSearchUrl(item);
                    row.dataset.searchQuery = item.search_query || '';
                    row.dataset.searchFilters = JSON.stringify(item.search_filters || {});
                    row.dataset.isGuest = isAuth ? '0' : '1';
                    row.dataset.guestIndex = isAuth ? '' : String(idx);
                    var metaHtml = isAuth ? '<span class="search-history-item-meta">' + escapeHtml(formatMeta(item)) + '</span>' : '';
                    var removeHtml = isAuth ? '<button type="button" class="search-history-item-remove" data-id="' + (item.id || ('local-' + idx)) + '" data-guest-index="' + idx + '" aria-label="Remove from history">×</button>' : '';
                    row.innerHTML = '<span class="search-history-item-icon"><i class="fa fa-clock-o" aria-hidden="true"></i></span><span class="search-history-item-text">' + escapeHtml(item.search_query) + '</span>' + metaHtml + removeHtml;
                    dropdown.appendChild(row);
                });
            }
            dropdown.classList.remove('hidden');
            dropdown.setAttribute('aria-hidden', 'false');
        }

        function escapeHtml(s) {
            if (!s) return '';
            const d = document.createElement('div');
            d.textContent = s;
            return d.innerHTML;
        }

        function hideHistory() {
            dropdown.classList.add('hidden');
            dropdown.setAttribute('aria-hidden', 'true');
        }

        function isGuestItemExpired(item) {
            try {
                var ts = item && item.created_at ? new Date(item.created_at).getTime() : 0;
                return !ts || (Date.now() - ts > GUEST_TTL_MS);
            } catch (e) { return true; }
        }

        function getGuestHistory(maxItems) {
            try {
                var raw = localStorage.getItem(GUEST_STORAGE_KEY);
                if (!raw) return [];
                var arr = JSON.parse(raw);
                if (!Array.isArray(arr)) return [];
                var valid = arr.filter(function (it) { return !isGuestItemExpired(it); });
                if (valid.length < arr.length) {
                    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(valid));
                }
                var limit = (maxItems != null && maxItems > 0) ? maxItems : GUEST_MAX_ITEMS;
                return valid.slice(0, limit).map(function (it, i) {
                    return {
                        id: 'local-' + i,
                        search_query: it.search_query,
                        search_filters: it.search_filters || {},
                        created_at: it.created_at,
                        results_count: it.results_count
                    };
                });
            } catch (e) { return []; }
        }
        window.getGuestSearchHistory = function (max) { return getGuestHistory(max); };

        function saveGuestSearchHistory(query, filters) {
            if (!query || typeof query !== 'string' || (window.USER_AUTHENTICATED === true)) return;
            try {
                var q = query.trim();
                if (!q) return;
                var f = filters || { by_title: true, by_text: true, by_tags: true };
                var arr = [];
                try {
                    var raw = localStorage.getItem(GUEST_STORAGE_KEY);
                    if (raw) arr = JSON.parse(raw);
                    if (!Array.isArray(arr)) arr = [];
                } catch (e) { arr = []; }
                arr = arr.filter(function (it) { return !isGuestItemExpired(it); });
                var now = new Date().toISOString();
                var dupIdx = arr.findIndex(function (it) {
                    return (it.search_query || '').toLowerCase() === q.toLowerCase() &&
                        JSON.stringify(it.search_filters || {}) === JSON.stringify(f);
                });
                if (dupIdx >= 0) arr.splice(dupIdx, 1);
                arr.unshift({ search_query: q, search_filters: f, created_at: now });
                if (arr.length > GUEST_MAX_ITEMS) arr.length = GUEST_MAX_ITEMS;
                localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(arr));
            } catch (e) { }
        }
        window.saveGuestSearchHistory = saveGuestSearchHistory;

        function bumpGuestSearchToTop(query, filters) {
            if (!query || (window.USER_AUTHENTICATED === true)) return;
            try {
                var q = String(query).trim();
                if (!q) return;
                var f = filters || { by_title: true, by_text: true, by_tags: true };
                var arr = [];
                try {
                    var raw = localStorage.getItem(GUEST_STORAGE_KEY);
                    if (raw) arr = JSON.parse(raw);
                    if (!Array.isArray(arr)) arr = [];
                } catch (e) { arr = []; }
                arr = arr.filter(function (it) { return !isGuestItemExpired(it); });
                var dupIdx = arr.findIndex(function (it) {
                    return (it.search_query || '').toLowerCase() === q.toLowerCase() &&
                        JSON.stringify(it.search_filters || {}) === JSON.stringify(f);
                });
                if (dupIdx >= 0) {
                    var it = arr.splice(dupIdx, 1)[0];
                    arr.unshift(it);
                    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(arr));
                }
            } catch (e) { }
        }
        window.bumpGuestSearchToTop = bumpGuestSearchToTop;

        function fetchAndShow(filterText) {
            function onLoaded(items) {
                cachedHistory = items || [];
                var filtered = filterText ? filterItems(cachedHistory, filterText) : cachedHistory;
                showHistory(filtered, !!filterText && filtered.length === 0);
            }
            if (isAuth) {
                fetch(listUrl, { credentials: 'same-origin' })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        onLoaded(data.items || []);
                    })
                    .catch(function () { dropdown.classList.add('hidden'); });
            } else {
                onLoaded(getGuestHistory());
            }
        }

        function filterItems(items, text) {
            if (!text || !text.trim()) return items;
            var lower = text.trim().toLowerCase();
            return items.filter(function (it) {
                return (it.search_query || '').toLowerCase().indexOf(lower) >= 0;
            });
        }

        function refreshAndFilter() {
            var val = (headerInput.value || '').trim();
            if (cachedHistory.length > 0) {
                var filtered = filterItems(cachedHistory, val);
                showHistory(filtered, !!val && filtered.length === 0);
            } else {
                fetchAndShow(val);
            }
        }

        headerInput.addEventListener('focus', function () {
            fetchAndShow((headerInput.value || '').trim());
        });
        headerInput.addEventListener('input', function () {
            var val = (headerInput.value || '').trim();
            if (cachedHistory.length > 0) {
                var filtered = filterItems(cachedHistory, val);
                showHistory(filtered, !!val && filtered.length === 0);
                dropdown.classList.remove('hidden');
                dropdown.setAttribute('aria-hidden', 'false');
            } else {
                fetchAndShow(val);
            }
        });

        function appendFromHistory(url) {
            const sep = url.indexOf('?') >= 0 ? '&' : '?';
            return url + sep + 'from_history=1';
        }

        dropdown.addEventListener('click', function (e) {
            var removeBtn = e.target.closest('.search-history-item-remove');
            if (removeBtn && isAuth && deletePattern) {
                e.preventDefault();
                e.stopPropagation();
                var row = removeBtn.closest('.search-history-item');
                var id = removeBtn.dataset.id || (row && row.dataset.id);
                if (!id) return;
                var deleteUrl = deletePattern.replace('999999', id);
                fetch(deleteUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'X-CSRFToken': getCSRF(),
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }).then(function () {
                    if (row) row.remove();
                    var remaining = dropdown.querySelectorAll('.search-history-item');
                    if (remaining.length === 0) hideHistory();
                }).catch(function () { });
                return;
            }
            var clearBtn = e.target.closest('.search-history-clear-btn');
            if (clearBtn && isAuth && clearUrl) {
                e.preventDefault();
                e.stopPropagation();
                fetch(clearUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'X-CSRFToken': getCSRF(),
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }).then(function () { hideHistory(); }).catch(function () { });
                return;
            }
            const historyRow = e.target.closest('.search-history-item');
            if (!historyRow) return;
            e.preventDefault();
            const historyId = historyRow.dataset && historyRow.dataset.id;
            const historyBaseUrl = historyRow.dataset && historyRow.dataset.url;
            if (!historyBaseUrl) return;
            if (!isAuth) {
                var q = historyRow.dataset && historyRow.dataset.searchQuery;
                var fStr = historyRow.dataset && historyRow.dataset.searchFilters;
                if (q && typeof window.bumpGuestSearchToTop === 'function') {
                    try {
                        var f = {};
                        if (fStr) try { f = JSON.parse(fStr); } catch (e) { }
                        window.bumpGuestSearchToTop(q, f);
                    } catch (err) { }
                }
            }
            const url = appendFromHistory(historyBaseUrl);
            try {
                sessionStorage.setItem('search_clear_next', '1');
                sessionStorage.removeItem('brainews_filter_active');
                sessionStorage.setItem('search_return_url', getSearchReturnUrl());
            } catch (err) { }
            if (isAuth && clickedPattern && historyId) {
                var clickedUrl = clickedPattern.replace('999999', historyId);
                fetch(clickedUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'X-CSRFToken': getCSRF(),
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    }
                }).catch(function () { });
            }
            window.location.href = url;
        });

        document.addEventListener('click', function (e) {
            if (!dropdown.classList.contains('hidden') &&
                !dropdown.contains(e.target) &&
                !headerInput.contains(e.target)) {
                hideHistory();
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !dropdown.classList.contains('hidden')) {
                hideHistory();
            }
        });
    })();

    // Accessibility: basic focus trap while overlay open
    document.addEventListener('focus', function (ev) {
        if (!overlayRoot || overlayRoot.classList.contains('hidden')) return;
        if (!overlayRoot.contains(ev.target)) {
            const focusable = overlayRoot.querySelector('input,button,select,textarea,a[href]');
            if (focusable) focusable.focus();
        }
    }, true);

});




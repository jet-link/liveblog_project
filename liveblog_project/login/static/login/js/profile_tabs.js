// static/js/profile-tabs.js
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const tabsBlock = document.querySelector('.tabs_block');
        const tabContentContainer = document.querySelector('.tab-content');
        if (!tabsBlock || !tabContentContainer) return;

        function currentActiveTabName() {
            const active = tabsBlock.querySelector('.nav-link.active');
            return active ? (active.dataset.tab || null) : null;
        }

        function urlWithTab(url, tabName) {
            try {
                const u = new URL(url, location.href); // use location.href as base
                if (tabName) u.searchParams.set('tab', tabName);
                return u.toString();
            } catch (e) {
                const sep = url.indexOf('?') === -1 ? '?' : '&';
                return url + sep + 'tab=' + encodeURIComponent(tabName);
            }
        }

        async function fetchAndReplace(url, pushState = true) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                if (!resp.ok) {
                    console.error('Failed to fetch', resp.status);
                    // fall back to full navigation
                    window.location.href = url;
                    return;
                }
                const text = await resp.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                const newContent = doc.querySelector('.tab-content');
                if (!newContent) {
                    // if server didn't return fragment — treat as full page
                    window.location.href = url;
                    return;
                }

                tabContentContainer.innerHTML = newContent.innerHTML;

                // sync active tab if server marked it
                const serverActive = doc.querySelector('.tabs_block .nav-link.active');
                if (serverActive) {
                    tabsBlock.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
                    const tabName = serverActive.dataset.tab;
                    if (tabName) {
                        const our = tabsBlock.querySelector('.nav-link[data-tab="' + tabName + '"]');
                        if (our) our.classList.add('active');
                    }
                } else {
                    // else derive from url param
                    try {
                        const p = new URL(url, location.href);
                        const paramTab = p.searchParams.get('tab') || 'all';
                        tabsBlock.querySelectorAll('.nav-link').forEach(n => n.classList.toggle('active', n.dataset.tab === paramTab));
                    } catch (e) { /* ignore */ }
                }

                const newTitle = doc.querySelector('title');
                if (newTitle) document.title = newTitle.textContent;

                if (pushState) history.pushState({ ajax: true, url: url }, '', url);

                // notify other scripts that content replaced
                window.dispatchEvent(new Event('profileTabContentReplaced'));

                const top = document.querySelector('.tabs_block');
                if (top) {
                    top.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch (err) {
                console.error('fetchAndReplace error', err);
                window.location.href = url; // fallback
            }
        }

        // Delegated click handler
        document.addEventListener('click', function (ev) {
            const a = ev.target.closest && ev.target.closest('a');
            if (!a) return;

            // ignore links without href or anchor-only
            const href = a.getAttribute('href');
            if (!href || href.trim() === '#' || href.trim().startsWith('javascript:')) return;

            // 1) Tab clicks (links inside .tabs_block)
            if (a.closest('.tabs_block')) {
                ev.preventDefault();
                const tabName = a.dataset.tab || null;
                let url = a.href;
                try {
                    const u = new URL(url, location.href); // important: use location.href
                    u.searchParams.delete('page'); // reset page to 1
                    if (tabName) u.searchParams.set('tab', tabName);
                    url = u.toString();
                } catch (e) {
                    url = urlWithTab(url, tabName);
                }
                fetchAndReplace(url);
                return;
            }

            // if explicit opt-out attribute present -> don't intercept
            if (a.dataset && a.dataset.noAjax !== undefined) return;
            if (a.classList && a.classList.contains('item-link')) return; // item detail links - normal navigation

            // 2) Pagination links: only intercept if link is inside .pagination OR contains page= param
            const inPagination = !!a.closest('.pagination');
            const hasPageParam = (href.indexOf('page=') !== -1);

            if (!inPagination && !hasPageParam) {
                // not a pagination link — do not intercept
                return;
            }

            // ensure same-origin
            try {
                const urlObj = new URL(href, location.href);
                if (urlObj.origin !== location.origin) return;
            } catch (e) {
                // invalid URL — skip interception
                return;
            }

            // now intercept pagination
            ev.preventDefault();

            const tabName = currentActiveTabName() || 'all';

            let targetUrl;
            try {
                const u = new URL(href, location.href); // crucial: use location.href so '?page=2' resolves to current path
                if (!u.searchParams.get('tab')) u.searchParams.set('tab', tabName);
                targetUrl = u.toString();
            } catch (e) {
                targetUrl = href + (href.indexOf('?') === -1 ? '?' : '&') + 'tab=' + encodeURIComponent(tabName);
            }

            fetchAndReplace(targetUrl);
        });

        // handle back/forward
        window.addEventListener('popstate', function (ev) {
            const u = (ev.state && ev.state.url) ? ev.state.url : location.href;
            fetchAndReplace(u, false);
        });

        // init history state
        (function initHistoryState() {
            const currentUrl = location.href;
            history.replaceState({ ajax: true, url: currentUrl }, '', currentUrl);
        })();

        // expose for other scripts (listing_manage)
        window.profileTabs = window.profileTabs || {};
        window.profileTabs.fetchAndReplace = fetchAndReplace;
    });
})();


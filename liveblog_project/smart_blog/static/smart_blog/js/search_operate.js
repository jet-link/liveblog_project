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

    function closeOverlay(onAfterAnimation) {
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

        overlayRoot.classList.add('overlay-sliding-down');
        overlayRoot.addEventListener('transitionend', function handler(e) {
            if (e.target !== overlayRoot || e.propertyName !== 'transform') return;
            overlayRoot.removeEventListener('transitionend', handler);
            doClose();
        }, { once: true });
        setTimeout(doClose, 420);
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
            const q = (inputEl && inputEl.value || '').trim();
            if (!q) return;
            const params = new URLSearchParams();
            params.set('q', q);
            if (chkTitle && chkTitle.checked) params.set('by_title', '1');
            if (chkText && chkText.checked) params.set('by_text', '1');
            if (chkTags && chkTags.checked) params.set('by_tags', '1');
            if (!((chkTitle && chkTitle.checked) || (chkText && chkText.checked) || (chkTags && chkTags.checked))) {
                params.set('by_title', '1'); params.set('by_text', '1'); params.set('by_tags', '1');
            }
            try { sessionStorage.removeItem('brainews_filter_active'); } catch (err) { }
            closeOverlay(function () {
                window.location.href = '/search/?' + params.toString();
            });
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
            const q = (headerInput.value || '').trim();
            if (!q) return;
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
            } catch (e) { }
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

    // Accessibility: basic focus trap while overlay open
    document.addEventListener('focus', function (ev) {
        if (!overlayRoot || overlayRoot.classList.contains('hidden')) return;
        if (!overlayRoot.contains(ev.target)) {
            const focusable = overlayRoot.querySelector('input,button,select,textarea,a[href]');
            if (focusable) focusable.focus();
        }
    }, true);

});




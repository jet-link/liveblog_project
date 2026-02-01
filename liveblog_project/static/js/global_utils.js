const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))


document.addEventListener("DOMContentLoaded", function () {
    const tooltipTriggerList = [].slice.call(
        document.querySelectorAll('[data-bs-title]')
    );
    tooltipTriggerList.forEach(el => {
        new bootstrap.Tooltip(el);
    });
});

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.ck-content table').forEach(function (t) {
        t.classList.add('table', 'table-bordered', 'table-striped');
    });
});

// Notifications bell count (sync from localStorage)
(function () {
    'use strict';

    function updateBellCountFromStorage() {
        const btn = document.querySelector('.notification-btn');
        if (!btn) return;

        let stored = null;
        try {
            stored = localStorage.getItem('notification_unread_count');
        } catch (err) {}

        const serverRaw = btn.dataset?.notificationsCount;
        const serverCount = serverRaw !== undefined && serverRaw !== null && serverRaw !== ''
            ? parseInt(serverRaw, 10)
            : NaN;
        const storedCount = stored !== null ? parseInt(stored, 10) : NaN;

        let count;
        if (!Number.isNaN(serverCount)) {
            // server is the source of truth when available
            count = serverCount;
        } else if (!Number.isNaN(storedCount)) {
            count = storedCount;
        } else {
            return;
        }

        try {
            localStorage.setItem('notification_unread_count', String(count));
        } catch (err) {}

        let badge = document.querySelector('.notifications-count');
        if (count <= 0) {
            if (badge) badge.remove();
            return;
        }
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'notifications-count custom_badge badge_danger';
            btn.insertBefore(badge, btn.querySelector('i'));
        }
        badge.textContent = count >= 10 ? '10+' : String(count);
    }

    document.addEventListener('DOMContentLoaded', updateBellCountFromStorage);
    window.addEventListener('pageshow', updateBellCountFromStorage);
    window.addEventListener('storage', function (e) {
        if (e.key === 'notification_unread_count') {
            updateBellCountFromStorage();
        }
    });
})();

// Replace broken avatar images with fallback
(function () {
    'use strict';

    const FALLBACK_AVATAR = '/static/img/no_image.svg';

    function applyAvatarFallback(img) {
        if (!img || img.dataset?.avatarFallbackApplied) return;
        img.dataset.avatarFallbackApplied = '1';
        img.onerror = null;
        img.src = FALLBACK_AVATAR;
    }

    // Capture load errors for avatar images
    window.addEventListener('error', function (e) {
        const target = e.target;
        if (target && target.tagName === 'IMG' && target.classList.contains('user-avatar')) {
            applyAvatarFallback(target);
        }
    }, true);
})();

// static/js/select_auto_size.js
(function () {
    'use strict';

    // Обновляет size для одного select
    function updateSelectSize(select, maxSize) {
        if (!select) return;
        // count only non-disabled options? here we count all options
        var optsCount = select.options ? select.options.length : 0;
        var desired = Math.min(Math.max(optsCount, 1), maxSize || 8);
        // If select имеет native multiple, устанавливаем size; иначе ничего не делаем
        try {
            if (select.multiple) {
                // избегаем ненужного перерендера
                if (String(select.size) !== String(desired)) {
                    select.size = desired;
                }
            } else {
                // если не multiple — ничего
                select.size = 0;
            }
        } catch (e) {
            // ignore
            console.error('updateSelectSize error', e);
        }
    }

    // Инициализация: находит все select.auto-size-select с data-auto-size
    function initAutoSizeSelects() {
        var selects = Array.prototype.slice.call(document.querySelectorAll('select.auto-size-select'));
        selects.forEach(function (sel) {
            try {
                var max = parseInt(sel.getAttribute('data-max-size') || sel.dataset.maxSize || 8, 10) || 8;
                updateSelectSize(sel, max);

                // следим за изменениями (если опции добавляются динамически)
                // MutationObserver следит за изменением списка option внутри select
                if (window.MutationObserver) {
                    var mo = new MutationObserver(function (mutList) {
                        // на любое изменение childList -> обновляем
                        updateSelectSize(sel, max);
                    });
                    mo.observe(sel, { childList: true, subtree: false });
                    // сохраняем ссылку чтобы при необходимости остановить наблюдение
                    sel.__autoSizeObserver = mo;
                }

                // Также подпишемся на кастомное событие 'auto-size:update' чтобы можно было вручную триггерить
                sel.addEventListener('auto-size:update', function (e) {
                    updateSelectSize(sel, max);
                });

                // optional: при изменении опций (например, пользователь выбрал/добавил теги через внешний UI),
                // вызывайте document.querySelector('select.auto-size-select').dispatchEvent(new Event('auto-size:update'));
            } catch (err) {
                console.error('auto-size init error', err);
            }
        });
    }

    // Инициализация при DOMContentLoaded и pageshow (bfcache)
    document.addEventListener('DOMContentLoaded', initAutoSizeSelects);
    window.addEventListener('pageshow', initAutoSizeSelects);

    // expose helper to window so you can call it manually if needed
    window.__autoSizeSelects = {
        updateAll: initAutoSizeSelects,
        updateOne: function (selector) {
            var sel = document.querySelector(selector);
            if (sel) sel.dispatchEvent(new Event('auto-size:update'));
        }
    };
})();



// static/js/search_field_overlay.js
(function () {
    'use strict';

    const floatingBtn = document.getElementById('floatingSearchBtn');
    const overlayRoot = document.getElementById('overlaySearchRoot');
    const overlayBackdrop = document.getElementById('overlaySearchBackdrop');
    const overlayContent = document.getElementById('overlaySearchContent');
    const overlayCloseBtn = document.getElementById('overlayCloseBtn');

    // element we track for visibility
    const originalSearchInner = document.querySelector('.header-search-inner');
    if (!originalSearchInner) {
        // nothing to do if no search on page
        if (floatingBtn) floatingBtn.style.display = 'none';
        return;
    }

    // build floating button behaviour: show when originalSearchInner is not in viewport
    // use IntersectionObserver
    let isOriginalVisible = true;
    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            isOriginalVisible = entry.isIntersecting;
            if (!isOriginalVisible) {
                // show floating
                floatingBtn.style.display = 'flex';
            } else {
                floatingBtn.style.display = 'none';
            }
        });
    }, {
        root: null,
        threshold: 0.1
    });

    io.observe(originalSearchInner);

    // helper: open overlay (clone the .header-search-inner so the existing form stays on page)
    function openOverlay() {
        if (!overlayRoot) return;
        overlayContent.innerHTML = ''; // clear
        const clone = originalSearchInner.cloneNode(true);
        // ensure input has same id inside clone; but avoid duplicate ids: remove id on clone inputs
        // we'll keep names for submission
        clone.querySelectorAll('[id]').forEach(el => {
            el.dataset.origId = el.id;
            el.removeAttribute('id');
        });

        overlayContent.appendChild(clone);

        overlayRoot.classList.remove('hidden');
        overlayRoot.classList.add('fade-in');

        // focus the search input inside clone
        const input = overlayContent.querySelector('input[type="search"], input[type="text"], textarea');
        if (input) {
            input.focus();
            input.select?.();
        }

        // bind submit on Enter — either form exists or we intercept keydown Enter
        bindOverlayHandlers();
        document.body.style.overflow = 'hidden'; // disable page scroll
        overlayRoot.setAttribute('aria-hidden', 'false');
    }

    function closeOverlay() {
        if (!overlayRoot) return;
        overlayRoot.classList.add('hidden');
        overlayContent.innerHTML = '';
        document.body.style.overflow = ''; // restore scroll
        overlayRoot.setAttribute('aria-hidden', 'true');
    }

    // build query and navigate (default target /items/search/ — change if needed)
    function doSearchAndClose(inputEl, container) {
        const q = (inputEl && inputEl.value || '').trim();
        // find checkboxes inside container
        const by_title = container.querySelector('#searchByTitle, input[name="by_title"]')?.checked ? '1' : '';
        const by_text = container.querySelector('#searchByText, input[name="by_text"]')?.checked ? '1' : '';
        const by_tags = container.querySelector('#searchByTags, input[name="by_tags"]')?.checked ? '1' : '';

        // if you have a server route for search, put it here
        const base = '/items/search/'; // change to your search view URL if needed
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (by_title) params.set('by_title', '1');
        if (by_text) params.set('by_text', '1');
        if (by_tags) params.set('by_tags', '1');

        const url = base + (params.toString() ? ('?' + params.toString()) : '');
        // close overlay first then navigate (small timeout for UX)
        closeOverlay();
        window.location.href = url;
    }

    // wire handlers inside overlay
    function bindOverlayHandlers() {
        const container = overlayContent;
        if (!container) return;

        // handle Enter key on search input -> submit
        const inputEl = container.querySelector('input[type="search"], input[type="text"], textarea');
        if (inputEl) {
            // avoid duplicate handlers
            inputEl.removeEventListener('keydown', onInputKeydown);
            inputEl.addEventListener('keydown', onInputKeydown);
        }

        // close btn inside overlay
        overlayBackdrop.onclick = closeOverlay;
    }

    function onInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const container = overlayContent;
            const inputEl = container.querySelector('input[type="search"], input[type="text"], textarea');
            doSearchAndClose(inputEl, container);
        }
    }

    // global close handlers
    floatingBtn.addEventListener('click', openOverlay);
    overlayCloseBtn.addEventListener('click', closeOverlay);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlayRoot.classList.contains('hidden')) {
            closeOverlay();
        }
    });

    // Accessibility: trap focus inside overlay when opened (basic)
    document.addEventListener('focus', (ev) => {
        if (overlayRoot && !overlayRoot.classList.contains('hidden')) {
            if (!overlayRoot.contains(ev.target)) {
                // redirect focus into overlay
                const focusable = overlayRoot.querySelector('input,button,select,textarea,a[href]');
                if (focusable) focusable.focus();
            }
        }
    }, true);

})();


// Share button
document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const modalEl = document.getElementById('shareItemModal');
    const copyBtn = document.getElementById('copyShareLinkBtn');
    const linkInput = document.getElementById('shareLinkInput');
    const feedback = document.getElementById('shareCopyFeedback');

    // Open source: if you want clicking .share_link to open modal (works with bootstrap attr too)
    document.querySelectorAll('.item_share_btn').forEach(el => {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            // Use Bootstrap 5 modal JS API to show
            const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.show();

            // After modal shown, select input for easy copying
            setTimeout(() => {
                if (linkInput) {
                    try { linkInput.select(); } catch (err) { }
                }
            }, 250);
        });
    });

    // Copy to clipboard
    if (copyBtn && linkInput) {
        copyBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            const text = linkInput.value || '';
            if (!text) return;

            // Try modern API
            try {
                await navigator.clipboard.writeText(text);
                showFeedback();
            } catch (err) {
                // Fallback: select + execCommand
                try {
                    linkInput.select();
                    document.execCommand('copy');
                    showFeedback();
                } catch (err2) {
                    console.warn('Copy failed', err2);
                    alert('Copy not supported in this browser. Select the link and copy manually.');
                }
            }
        });
    }

    function showFeedback() {
        if (!feedback) return;
        feedback.style.display = '';
        // auto hide
        setTimeout(() => { feedback.style.display = 'none'; }, 2200);
    }

    // Share to social networks
    const url = linkInput ? encodeURIComponent(linkInput.value) : encodeURIComponent(window.location.href);
    const shareMap = {
        twitter: () => {
            const text = encodeURIComponent(document.title);
            window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'noopener');
        },
        telegram: () => {
            window.open(`https://t.me/share/url?url=${url}`, '_blank', 'noopener');
        },
        whatsapp: () => {
            const base = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'whatsapp://' : 'https://api.whatsapp.com';
            window.open(`${base}/send?text=${url}`, '_blank', 'noopener');
        }
    };

    const btnTwitter = document.getElementById('shareTwitter');
    const btnTelegram = document.getElementById('shareTelegram');
    const btnWhatsapp = document.getElementById('shareWhatsapp');

    if (btnTwitter) btnTwitter.addEventListener('click', shareMap.twitter);
    if (btnTelegram) btnTelegram.addEventListener('click', shareMap.telegram);
    if (btnWhatsapp) btnWhatsapp.addEventListener('click', shareMap.whatsapp);

    // Manage focus return to trigger (accessibility)
    let lastTrigger = null;

    document.querySelectorAll('.item_share_btn').forEach(el => {
        el.addEventListener('click', () => {
            lastTrigger = el;
        });
    });

    if (modalEl) {
        modalEl.addEventListener('hide.bs.modal', () => {
            const active = document.activeElement;
            if (active && modalEl.contains(active)) {
                active.blur(); // 🔥 важно
            }
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (lastTrigger && typeof lastTrigger.focus === 'function') {
                lastTrigger.focus();
            }
        });
    }
});



// static/js/password-toggle.js
(function () {
    'use strict';

    function findToggles() {
        const toggles = Array.from(document.querySelectorAll('[data-password-toggle]'));
        Array.from(document.querySelectorAll('a, button')).forEach(el => {
            const txt = (el.textContent || '').trim();
            if (!el.hasAttribute('data-password-toggle') && txt === 'Show password') {
                el.setAttribute('data-password-toggle', '1');
                toggles.push(el);
            }
        });
        return Array.from(new Set(toggles));
    }

    function isPasswordInput(node) {
        return node && node.tagName.toLowerCase() === 'input' &&
            (node.type === 'password' || node.type === 'text' || node.dataset.isPassword === '1');
    }

    function getPasswordFieldsForToggle(toggle) {
        const form = toggle.closest('form');
        if (form) {
            return Array.from(form.querySelectorAll('input[type="password"], input[data-is-password="1"], input.password-field'));
        }
        return Array.from(document.querySelectorAll('input[type="password"], input[data-is-password="1"]'));
    }

    function updateToggleVisibility(toggle, fields) {
        const anyValue = fields.some(f => String(f.value || '').trim() !== '');
        if (anyValue) {
            toggle.classList.add('visible');
            toggle.setAttribute('aria-hidden', 'false');
        } else {
            toggle.classList.remove('visible');
            toggle.setAttribute('aria-hidden', 'true');
            fields.forEach(f => {
                if (f.dataset._pwShown === '1') {
                    try { f.type = 'password'; } catch (e) { }
                    f.dataset._pwShown = '0';
                }
            });
            toggle.innerHTML = `Show<i class="fa fa-eye mx-2"></i>password`;
            toggle.setAttribute('aria-pressed', 'false');
            toggle.dataset.state = 'hidden';
        }
    }

    function togglePassword(toggle, fields) {
        const isShown = toggle.dataset.state === 'shown';

        if (isShown) {
            fields.forEach(f => {
                try { f.type = 'password'; } catch (e) { }
                f.dataset._pwShown = '0';
            });
            toggle.dataset.state = 'hidden';
            toggle.setAttribute('aria-pressed', 'false');
            toggle.innerHTML = `Show<i class="fa fa-eye mx-2"></i>password`;
        } else {
            fields.forEach(f => {
                try { f.type = 'text'; } catch (e) { }
                f.dataset._pwShown = '1';
            });
            toggle.dataset.state = 'shown';
            toggle.setAttribute('aria-pressed', 'true');
            toggle.innerHTML = `Hide<i class="fa fa-eye-slash mx-2"></i>password`;
        }
    }

    function wireToggle(toggle) {
        const fields = getPasswordFieldsForToggle(toggle);
        if (!fields.length) {
            toggle.classList.remove('visible');
            return;
        }

        toggle.dataset.state = 'hidden';
        toggle.setAttribute('aria-pressed', 'false');

        // Блокируем Enter/Space когда toggle в фокусе (чтобы не срабатывать через клавиатуру)
        toggle.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });

        // Клик: разрешаем только реальный мышиный клик (event.detail > 0).
        // Игнорируем клавиатурные / программные активации (detail === 0).
        toggle.addEventListener('click', e => {
            // если это click с клавиатуры или программный click (detail === 0) — игнорируем
            // (реальные мышиные клики имеют detail >= 1)
            if (typeof e.detail === 'number' && e.detail === 0) {
                // предотвращаем переход по ссылке (#) и всплытие, но не выполняем toggle
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.preventDefault();
            togglePassword(toggle, fields);
        });

        fields.forEach(f => {
            if (!isPasswordInput(f)) f.dataset.isPassword = '1';

            ['input', 'keyup', 'change'].forEach(evt =>
                f.addEventListener(evt, () => updateToggleVisibility(toggle, fields), { passive: true })
            );
        });

        updateToggleVisibility(toggle, fields);
    }

    function initPasswordToggles() {
        findToggles().forEach(t => {
            if (!t.dataset._pwInit) {
                t.dataset._pwInit = '1';
                wireToggle(t);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initPasswordToggles();

        // несколько повторных инициализаций на случай динамики/генератора пароля
        setTimeout(initPasswordToggles, 400);
        setTimeout(initPasswordToggles, 1000);

        if ('MutationObserver' in window) {
            new MutationObserver(() => initPasswordToggles())
                .observe(document.body, { childList: true, subtree: true });
        }
    });

})();


//pre code block badge, ckeditor
(function () {
    'use strict';

    function normalizeLang(s) {
        if (!s) return '';
        s = String(s).trim().toLowerCase();
        // небольшие сокращения/замены
        s = s.replace(/^language-/, '').replace(/^lang-/, '');
        return s;
    }

    function labelFromClassOrData(codeEl) {
        // сначала dataset
        if (codeEl && codeEl.dataset && codeEl.dataset.language) return normalizeLang(codeEl.dataset.language);

        // затем класс like language-python or lang-python
        if (codeEl && codeEl.className) {
            var m = (codeEl.className || '').match(/(?:^|\s)(?:language|lang)-([a-z0-9_+-]+)/i);
            if (m) return normalizeLang(m[1]);
        }
        // if pre has data-language
        var pre = codeEl && codeEl.closest ? codeEl.closest('pre') : null;
        if (pre && pre.dataset && pre.dataset.language) return normalizeLang(pre.dataset.language);

        return '';
    }

    function makeBadge(lang) {
        var span = document.createElement('span');
        span.className = 'code-lang-badge ' + ('lang-' + lang);
        span.textContent = lang;
        return span;
    }

    function applyBadges() {
        document.querySelectorAll('pre').forEach(function (pre) {
            // try find code element inside
            var code = pre.querySelector('code');
            if (!code) return;

            var lang = labelFromClassOrData(code);
            if (!lang) return;

            // mark pre so CSS can add top padding
            pre.classList.add('has-code-lang');

            // prevent adding duplicate badge
            if (pre.querySelector('.code-lang-badge')) return;

            var badge = makeBadge(lang);
            // place badge inside pre
            pre.insertBefore(badge, pre.firstChild);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyBadges, { once: true });
    } else {
        applyBadges();
    }
})();




// // sticky header (disabled for now)
// (function () {
//     const header = document.querySelector('.header');
//     if (!header) return;
//
//     const userMenu = document.getElementById('userMenu');
//
//     let lastScrollY = window.scrollY;
//     let ticking = false;
//
//     // spacer
//     const spacer = document.createElement('div');
//     spacer.className = 'header-spacer';
//     header.after(spacer);
//
//     const headerHeight = header.getBoundingClientRect().height;
//     spacer.style.height = headerHeight + 'px';
//
//     const DELTA = 6;
//
//     function closeUserMenu() {
//         if (userMenu) {
//             userMenu.classList.remove('open');
//         }
//     }
//
//     function onScroll() {
//         const currentY = window.scrollY;
//         const diff = currentY - lastScrollY;
//
//         if (Math.abs(diff) > DELTA) {
//             if (diff > 0) {
//                 // ⬇️ скроллим вниз — header исчезает
//                 header.classList.add('header--hidden');
//
//                 // 🔥 ВАЖНО: закрываем меню
//                 closeUserMenu();
//             } else {
//                 // ⬆️ скроллим вверх — header появляется
//                 header.classList.remove('header--hidden');
//             }
//
//             lastScrollY = currentY;
//         }
//
//         ticking = false;
//     }
//
//     window.addEventListener('scroll', () => {
//         if (!ticking) {
//             requestAnimationFrame(onScroll);
//             ticking = true;
//         }
//     }, { passive: true });
// })();



// main page items
function renderReplyErrors(container, messages) {
    if (!container) return;
    container.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'invalid-feedback d-block';

    if (Array.isArray(messages)) {
        box.textContent = messages.join(' ');
    } else {
        box.textContent = String(messages);
    }

    container.appendChild(box);
}

document.addEventListener('DOMContentLoaded', function () {
    const STEP = 10;

    const wrapper = document.getElementById('showMoreWrapper');
    if (!wrapper) return; // нет кнопки — значит страница не listing

    const btn = document.getElementById('showMoreBtn');
    const counter = document.getElementById('shownCounter');

    const items = Array.from(document.querySelectorAll('.item-card'));
    if (!items.length || !btn || !counter) return;

    const total = items.length;
    let shown = 0;

    function update(withAnimation = false, fromIndex = 0) {
        items.forEach((item, index) => {
            if (index < shown) {
                if (item.classList.contains('listing-hidden')) {
                    item.classList.remove('listing-hidden');

                    if (withAnimation && index >= fromIndex) {
                        item.classList.remove('listing-animate');
                        void item.offsetWidth; // reflow
                        item.classList.add('listing-animate');
                    }
                }
            } else {
                item.classList.add('listing-hidden');
                item.classList.remove('listing-animate');
            }
        });

        counter.textContent = `${shown} / ${total}`;

        if (shown >= total) {
            btn.style.display = 'none';
        }
    }

    // 🔥 старт
    shown = Math.min(STEP, total);
    update(false);

    btn.addEventListener('click', () => {
        const prev = shown;
        shown = Math.min(shown + STEP, total);
        update(true, prev);
    });
});




// static/js/bottom_menu.js
(function () {
    'use strict';

    const menu = document.getElementById('bottomSideMenu');
    const overlay = document.getElementById('bottomMenuOverlay');
    const openBtn = document.getElementById('bottomBurgerBtn');
    const closeBtn = document.getElementById('bottomMenuClose');

    if (!menu || !overlay || !openBtn || !closeBtn) return;

    let isOpen = false;

    const prevOverflow = {
        html: '',
        body: ''
    };

    function openBottomMenu() {
        if (isOpen) return;
        isOpen = true;

        // 🔒 save scroll
        prevOverflow.html = document.documentElement.style.overflow;
        prevOverflow.body = document.body.style.overflow;

        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        // show overlay + menu
        overlay.classList.remove('hidden');
        menu.classList.remove('hidden');
        requestAnimationFrame(() => {
            menu.classList.add('open');
        });

        menu.removeAttribute('inert');
        menu.setAttribute('aria-hidden', 'false');

        closeBtn.focus();
    }

    function closeBottomMenu() {
        if (!isOpen) return;
        isOpen = false;

        // 🔑 remove focus first
        document.activeElement?.blur();

        // hide menu with animation
        menu.classList.remove('open');

        setTimeout(() => {
            menu.classList.add('hidden');
            overlay.classList.add('hidden');

            menu.setAttribute('aria-hidden', 'true');
            menu.setAttribute('inert', '');

            // 🔓 restore scroll
            document.documentElement.style.overflow = prevOverflow.html || '';
            document.body.style.overflow = prevOverflow.body || '';
        }, 250); // must match CSS transition
    }

    // ===== EVENTS =====
    openBtn.addEventListener('click', openBottomMenu);
    closeBtn.addEventListener('click', closeBottomMenu);
    overlay.addEventListener('click', closeBottomMenu);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            closeBottomMenu();
        }
    });

})();


// static/js/bootstrap_modal_fix.js
(function () {
    'use strict';

    document.addEventListener('hide.bs.modal', function (event) {
        // 🔑 убрать фокус ДО aria-hidden
        const active = document.activeElement;
        if (active && event.target.contains(active)) {
            active.blur();
        }
    });

})();


// SPA-logout
// (function () {
//     const menu = document.getElementById('userMenu');
//     if (!menu) return;

//     const logoutBtn = menu.querySelector('.user-logout-btn');
//     if (!logoutBtn) return;

//     function getCSRF() {
//         return document.querySelector('[name=csrfmiddlewaretoken]')?.value
//             || document.cookie.match(/csrftoken=([^;]+)/)?.[1];
//     }

//     logoutBtn.addEventListener('click', async (e) => {
//         e.preventDefault();
//         e.stopPropagation();

//         const url = logoutBtn.dataset.logoutUrl;
//         if (!url) return;

//         logoutBtn.style.pointerEvents = 'none';

//         try {
//             const resp = await fetch(url, {
//                 method: 'POST',
//                 headers: {
//                     'X-CSRFToken': getCSRF(),
//                     'X-Requested-With': 'XMLHttpRequest',
//                     'Accept': 'application/json'
//                 }
//             });

//             const data = await resp.json();
//             if (!data?.success) return;

//             // ✅ 1. закрываем tooltip
//             menu.classList.remove('open');

//             // ✅ 2. заменяем user-menu на Login
//             menu.outerHTML = `
//                 <a href="/profile/login/"
//                    class="text-muted text-decoration-none">
//                    <i class="fa fa-user-circle fs-4"></i>
//                 </a>
//             `;

//         } catch (err) {
//             console.error('Logout failed:', err);
//         }
//     });
// })();
// categories_modal.js — Categories dropdown-modal (header + overlay triggers)
(function () {
    'use strict';

    const root = document.getElementById('categoriesModalRoot');
    const backdrop = document.getElementById('categoriesModalBackdrop');
    const closeBtn = document.getElementById('categoriesModalClose');
    const dialogEl = document.getElementById('categoriesModalDialog');

    if (!root || !backdrop || !closeBtn || !dialogEl) return;

    const TRIG_SEL = '.categories-modal-trigger';
    let isOpen = false;
    let lastTrigger = null;

    const prevOverflow = { html: '', body: '' };

    const chipsBtn = document.getElementById('categoriesModalChipsMoreBtn');
    const chipsExtrasWrap = document.getElementById('categoriesModalChipsExtrasWrap');

    function setExpandIcon(btn, up) {
        if (!btn) return;
        const i = btn.querySelector('i');
        if (!i) return;
        i.className = up ? 'fa fa-angle-up' : 'fa fa-angle-down';
    }

    function closeChipsExpand() {
        if (!chipsBtn || !chipsExtrasWrap) return;
        chipsExtrasWrap.classList.remove('is-expanded');
        chipsExtrasWrap.setAttribute('inert', '');
        chipsExtrasWrap.setAttribute('aria-hidden', 'true');
        chipsBtn.setAttribute('aria-expanded', 'false');
        setExpandIcon(chipsBtn, false);
    }

    function toggleChipsExpand() {
        if (!chipsBtn || !chipsExtrasWrap) return;
        const willOpen = !chipsExtrasWrap.classList.contains('is-expanded');
        chipsExtrasWrap.classList.toggle('is-expanded', willOpen);
        if (willOpen) {
            chipsExtrasWrap.removeAttribute('inert');
            chipsExtrasWrap.setAttribute('aria-hidden', 'false');
        } else {
            chipsExtrasWrap.setAttribute('inert', '');
            chipsExtrasWrap.setAttribute('aria-hidden', 'true');
        }
        chipsBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        setExpandIcon(chipsBtn, willOpen);
    }

    if (chipsBtn) {
        chipsBtn.addEventListener('click', function (e) {
            e.preventDefault();
            toggleChipsExpand();
        });
    }

    function setTriggersExpanded(open) {
        document.querySelectorAll(TRIG_SEL).forEach(function (el) {
            el.setAttribute('aria-expanded', open ? 'true' : 'false');
            el.classList.toggle('active', open);
            el.querySelectorAll('.fa-angle-down').forEach(function (i) {
                i.classList.toggle('hidden', open);
            });
            el.querySelectorAll('.fa-angle-up').forEach(function (i) {
                i.classList.toggle('hidden', !open);
            });
        });
    }

    function openModal(triggerEl) {
        if (isOpen) return;
        isOpen = true;
        lastTrigger = triggerEl && triggerEl.matches(TRIG_SEL) ? triggerEl : null;

        prevOverflow.html = document.documentElement.style.overflow;
        prevOverflow.body = document.body.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        root.classList.remove('hidden');
        root.setAttribute('aria-hidden', 'false');
        setTriggersExpanded(true);

        closeChipsExpand();

        closeBtn.focus();
    }

    function closeModal() {
        if (!isOpen) return;
        isOpen = false;

        document.documentElement.style.overflow = prevOverflow.html || '';
        document.body.style.overflow = prevOverflow.body || '';

        root.classList.add('hidden');
        root.setAttribute('aria-hidden', 'true');
        setTriggersExpanded(false);

        const t = lastTrigger;
        lastTrigger = null;
        if (t && document.body.contains(t)) {
            try {
                t.focus();
            } catch (e) { /* ignore */ }
        }
    }

    document.addEventListener('click', function (e) {
        const trigger = e.target.closest(TRIG_SEL);
        if (!trigger) return;

        e.preventDefault();

        if (isOpen) {
            return;
        }

        openModal(trigger);
    });

    closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeModal();
    });

    backdrop.addEventListener('click', function () {
        closeModal();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            closeModal();
        }
    });
})();

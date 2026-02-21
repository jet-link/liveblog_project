// back_to_top.js — кнопка «Наверх», показ после 50vh скролла
(function () {
    'use strict';
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    if (document.getElementById('commentsBackToTop')) {
        btn.style.display = 'none';
        return;
    }

    const SCROLL_THRESHOLD = 0.8;

    function getThreshold() {
        return window.innerHeight * SCROLL_THRESHOLD;
    }

    function checkVisibility() {
        const scrollY = window.scrollY || window.pageYOffset;
        if (scrollY >= getThreshold()) {
            btn.classList.add('is-visible');
        } else {
            btn.classList.remove('is-visible');
        }
    }

    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility);

    btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

(function () {
    'use strict';

    var wrapper = document.querySelector('.header-wrapper');
    if (!wrapper) return;

    var lastY = window.scrollY || window.pageYOffset || 0;
    var ticking = false;
    var SCROLL_MIN = 56;

    function update() {
        var y = window.scrollY || window.pageYOffset || 0;
        if (y <= 8) {
            wrapper.classList.remove('header-wrapper--hidden');
        } else if (y > lastY && y > SCROLL_MIN) {
            wrapper.classList.add('header-wrapper--hidden');
        } else if (y < lastY) {
            wrapper.classList.remove('header-wrapper--hidden');
        }
        lastY = y;
        ticking = false;
    }

    window.addEventListener(
        'scroll',
        function () {
            if (!ticking) {
                window.requestAnimationFrame(update);
                ticking = true;
            }
        },
        { passive: true }
    );
})();

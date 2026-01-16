(function () {
    const menu = document.getElementById('userMenu');
    if (!menu) return;

    const avatar = menu.querySelector('.user-avatar-btn');

    function isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    avatar.addEventListener('click', (e) => {
        if (isMobile()) {
            // 📱 MOBILE → обычный переход по ссылке
            return;
        }

        // 🖥 DESKTOP → tooltip
        e.preventDefault();
        e.stopPropagation();
        menu.classList.toggle('open');
    });

    // закрытие по клику вне
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) {
            menu.classList.remove('open');
        }
    });

    // закрытие по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            menu.classList.remove('open');
        }
    });
})();
document.addEventListener('DOMContentLoaded', function () {
    const profileCard = document.getElementById('profileCard');
    const passwordCard = document.getElementById('passwordCard');
    const showBtn = document.getElementById('showPasswordBtn');
    const closeBtn = document.getElementById('closePasswordBtn');

    // helper: show password card
    function showPasswordCard() {
        if (!profileCard || !passwordCard) return;
        // profile уезжает вверх (is-visible -> is-hidden)
        profileCard.classList.remove('is-visible');
        profileCard.classList.add('is-hidden');

        // passwordCard приходит сверху
        passwordCard.classList.remove('is-hidden');
        // добавляем небольшую паузу чтобы transition сработал корректно
        requestAnimationFrame(() => {
            passwordCard.classList.add('is-visible');
        });

        // focus first input
        const input = passwordCard.querySelector('input, textarea, select');
        if (input) {
            setTimeout(() => input.focus(), 260);
        }
        // handle ESC to close
        document.addEventListener('keydown', escHandler);
    }

    function hidePasswordCard() {
        if (!profileCard || !passwordCard) return;
        // password уезжает вверх
        passwordCard.classList.remove('is-visible');
        // через timeout (подождём окончание анимации) добавим is-hidden
        setTimeout(() => {
            passwordCard.classList.add('is-hidden');
        }, 420);

        // вернуть profile обратно
        profileCard.classList.remove('is-hidden');
        requestAnimationFrame(() => {
            profileCard.classList.add('is-visible');
        });

        // focus на первую кнопку Save формы профиля
        const btn = profileCard.querySelector('[type="submit"], button');
        if (btn) setTimeout(() => btn.focus(), 260);

        document.removeEventListener('keydown', escHandler);
    }

    function escHandler(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            hidePasswordCard();
        }
    }

    if (showBtn) showBtn.addEventListener('click', function (e) {
        e.preventDefault();
        showPasswordCard();
    });

    if (closeBtn) closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        hidePasswordCard();
    });

    // Accessibility: when user navigates away, ensure cards in consistent state
    window.addEventListener('beforeunload', function () {
        // nothing special needed
    });
});
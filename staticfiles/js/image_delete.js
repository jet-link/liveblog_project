// static/smart_blog/js/image_delete.js
(function () {
    'use strict';

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const c = cookies[i].trim();
                if (c.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(c.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    document.addEventListener('DOMContentLoaded', function () {
        // делегируем обработку кликов на документе — удобно если блоки динамически меняются
        document.addEventListener('click', async function (ev) {
            const btn = ev.target.closest && ev.target.closest('.btn-delete-image');
            if (!btn) return;

            ev.preventDefault();

            const url = btn.dataset.deleteUrl;
            const imageId = btn.dataset.imageId;

            if (!url) {
                console.warn('Delete URL not provided');
                return;
            }

            // визуальная блокировка кнопки
            btn.disabled = true;
            btn.classList.add('opacity-75');

            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json'
                    },
                    credentials: 'same-origin'
                });

                const data = await resp.json().catch(() => null);

                if (!resp.ok || !data || !data.success) {
                    // не показываем alert — просто логируем, снятие блокировки
                    console.warn('Delete failed', data && data.error);
                    btn.disabled = false;
                    btn.classList.remove('opacity-75');
                    return;
                }

                // корректно ищем узел: сначала по id 'image-<id>', иначе ближайший .existing-image
                const node = (document.getElementById('image-' + data.image_id) || btn.closest('.existing-image'));
                if (node) {
                    // плавно убираем элемент, затем удаляем (необязательно — можно сразу remove)
                    node.style.transition = 'opacity .18s ease, transform .18s ease';
                    node.style.opacity = '0';
                    node.style.transform = 'scale(.98)';
                    setTimeout(() => node.remove(), 180);
                }

                // обновить подсказку/индикатор если есть (например #imagesHelp)
                const help = document.getElementById('imagesHelp');
                if (help && typeof data.remaining !== 'undefined') {
                    help.textContent = `Remaining: ${data.remaining}`;
                }
            } catch (err) {
                console.error('Image delete error', err);
                btn.disabled = false;
                btn.classList.remove('opacity-75');
            }
        });
    });
})();
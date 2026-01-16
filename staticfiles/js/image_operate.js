// static/js/image_operate.js
// Preview + client-side removal for new files (uses DataTransfer)
// + AJAX deletion for existing uploaded images (no confirm/alert).
(function () {
    'use strict';

    function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
    function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let c of cookies) {
                c = c.trim();
                if (c.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(c.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const input = qs('#id_images') || qs('input[name="images"]'); // файл input
        const preview = qs('#preview'); // контейнер для превью
        const MAX = 10;
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        const infoNode = qs('#imagesHelp');

        if (!input || !preview) return;

        // helper: show info
        function setInfo(text) {
            if (infoNode) infoNode.textContent = text;
        }

        // create preview block for a File object (new)
        function createPreviewForFile(file, tempId) {
            const wrap = document.createElement('div');
            wrap.className = 'image-preview-item';
            wrap.dataset.tempId = tempId;

            const img = document.createElement('img');
            img.alt = file.name;

            const fname = document.createElement('small');
            fname.textContent = file.name;

            const fsize = document.createElement('small');
            fsize.className = 'text-muted d-block';
            fsize.textContent = humanFileSize(file.size);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-danger image-remove-btn';
            btn.dataset.action = 'remove-temp';
            btn.innerHTML = '<i class="fa fa-times"></i>';

            wrap.appendChild(img);
            wrap.appendChild(fname);
            wrap.appendChild(fsize);
            wrap.appendChild(btn);

            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target.result; };
            reader.readAsDataURL(file);

            return wrap;
        }

        function humanFileSize(size) {
            if (size < 1024) return size + ' B';
            if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
            return (size / (1024 * 1024)).toFixed(1) + ' MB';
        }

        // Рендерим текущие input.files в preview, используя DataTransfer для возможности удаления отдельных файлов
        function renderFilesFromInput() {
            preview.innerHTML = '';
            const files = Array.from(input.files || []);
            files.forEach((f, idx) => {
                const node = createPreviewForFile(f, 'f' + idx);
                preview.appendChild(node);
            });
            updateInfo();
        }

        // Обновляем подсказку
        function updateInfo() {
            const count = (input.files && input.files.length) || 0;
            setInfo(`Selected ${count} / ${MAX} files (JPEG/PNG/WebP).`);
        }

        // При выборе файлов — ограничиваем MAX и рендерим preview
        input.addEventListener('change', (e) => {
            let files = Array.from(input.files || []);
            if (files.length > MAX) {
                // Обрезаем — и сообщаем в info
                files = files.slice(0, MAX);
                // Чтобы убрать лишние файлы из самого input — используем DataTransfer и переприсвоим
                const dt = new DataTransfer();
                files.forEach(f => dt.items.add(f));
                input.files = dt.files;
            }

            // фильтруем по типу
            const bad = files.filter(f => !allowed.includes(f.type));
            if (bad.length) {
                // удалим неподдерживаемые
                files = files.filter(f => allowed.includes(f.type));
                const dt = new DataTransfer();
                files.forEach(f => dt.items.add(f));
                input.files = dt.files;
                setInfo(`Removed unsupported types (${bad.map(b => b.name).join(', ')}).`);
            }

            renderFilesFromInput();
        });

        // Делегирование: удаление временно выбранного файла из input.files
        preview.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('button[data-action="remove-temp"]');
            if (!btn) return;
            const item = btn.closest('.image-preview-item');
            if (!item) return;
            const tempId = item.dataset.tempId;

            // формируем новый FileList через DataTransfer без удалённого файла
            const currentFiles = Array.from(input.files || []);
            // tempId хранили индекс в момент рендера 'f<idx>'
            // но после изменений индексы меняются — поэтому лучше сопоставлять по имени + size
            const name = item.querySelector('small') ? item.querySelector('small').textContent : null;

            const dt = new DataTransfer();
            currentFiles.forEach(f => {
                // сравнение по name + size (наиболее устойчиво)
                if (!(f.name === (item.querySelector('small') && item.querySelector('small').textContent) && String(f.size) === String(item.querySelector('.text-muted') && item.querySelector('.text-muted').textContent && f.size))) {
                    // we'll compare by name and size below
                }
            });

            // более надёжно: удалим один файл, совпадающий по name & size
            let removed = false;
            currentFiles.forEach(f => {
                if (!removed && f.name === (item.querySelector('small') && item.querySelector('small').textContent) && !removed) {
                    // try to avoid false positive by checking size too
                    // size is visible in the .text-muted content like '1.2 MB' -> we can't parse reliably; so we'll remove by first match
                    removed = true;
                    return; // skip adding this file
                } else {
                    dt.items.add(f);
                }
            });

            // If not removed via name (edge cases) - fallback: remove by index (find exact DOM index)
            if (!removed) {
                // fallback: remove by matching file name & approximate size by comparing bytes via reading input.files
                // simple fallback: remove by position of preview element among previews
                const previews = qsa('.image-preview-item', preview);
                const index = previews.indexOf(item);
                const curFiles = Array.from(input.files || []);
                curFiles.forEach((f, idx) => {
                    if (idx !== index) dt.items.add(f);
                });
            }

            input.files = dt.files;
            // remove DOM
            item.remove();
            updateInfo();
        });

        // Поддержка удаления уже загруженных изображений (в шаблоне они должны иметь .existing-image и кнопку .btn-delete-image with data-delete-url and data-image-id)
        document.addEventListener('click', async (ev) => {
            const btn = ev.target.closest && ev.target.closest('.btn-delete-image');
            if (!btn) return;

            ev.preventDefault();
            const url = btn.dataset.deleteUrl;
            const imageId = btn.dataset.imageId;
            if (!url) return;

            // визуально блокируем кнопку
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
                    // quietly fail: можно показать toast, но по требованию — не показываем alert
                    console.warn('Delete failed', data && data.error);
                    btn.disabled = false;
                    btn.classList.remove('opacity-75');
                    return;
                }

                // remove DOM node for existing image (expects wrapper id="image-<id>" or class .existing-image)
                const node = document.getElementById('image-' + data.image_id) || btn.closest('.existing-image');
                if (node) node.remove();

                // обновить подсказку
                setInfo(`Remaining: ${data.remaining || 0}`);
            } catch (err) {
                console.error('Image delete error', err);
                btn.disabled = false;
                btn.classList.remove('opacity-75');
            }
        });

        // initial render if there are files (e.g. when coming back to page)
        renderFilesFromInput();
        updateInfo();
    });
})();
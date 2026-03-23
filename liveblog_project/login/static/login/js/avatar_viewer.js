
// static/js/avatar-viewer.js
(function () {
    'use strict';

    const SELECTOR = '.personal_avatar .avatar-wrapper';
    const THUMB_SELECTOR = '.profile-mobile-avatar-thumb';

    const __avatarPrevOverflow = {
        html: '',
        body: '',
        paddingRight: ''
    };

    function init() {
        document.addEventListener('click', function (e) {
            const thumbBtn = e.target.closest(THUMB_SELECTOR);
            if (thumbBtn) {
                const img = thumbBtn.querySelector('img');
                if (!img) return;
                if (img.classList.contains('avatar-load-failed') || img.src.includes('no_avatar') || img.src.includes('no_image')) return;
                e.preventDefault();
                openLightbox(img.dataset.full || img.src, img.alt || 'Avatar');
                return;
            }

            const wrapper = e.target.closest(SELECTOR);
            if (!wrapper) return;

            if (e.target.closest('.avatar-remove-overlay')) return;

            const img = wrapper.querySelector('img');
            if (!img) return;

            if (img.classList.contains('avatar-load-failed') || img.src.includes('no_avatar') || img.src.includes('no_image')) return;

            e.preventDefault();

            openLightbox(
                img.dataset.full || img.src,
                img.alt || 'Avatar'
            );
        });
    }

    function createLightbox() {
        const overlay = document.createElement('div');
        overlay.id = 'avatarLightboxOverlay';
        overlay.className = 'avatar-lightbox-overlay';

        const container = document.createElement('div');
        container.className = 'avatar-lightbox-container';

        const img = document.createElement('img');
        img.className = 'avatar-lightbox-img';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'avatar-lightbox-close';
        closeBtn.innerHTML = '&times;';

        container.appendChild(img);
        overlay.appendChild(container);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        bindEvents({ overlay, img, closeBtn });
        return { overlay, img, closeBtn };
    }

    function openLightbox(src, alt) {
        if (!window.__avatarLB__) {
            window.__avatarLB__ = createLightbox();
        }

        const lb = window.__avatarLB__;

        __avatarPrevOverflow.html = document.documentElement.style.overflow;
        __avatarPrevOverflow.body = document.body.style.overflow;
        __avatarPrevOverflow.paddingRight = document.body.style.paddingRight;

        lb.img.src = src;
        lb.img.alt = alt;
        lb.overlay.style.display = 'flex';

        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = '0px';
    }

    function closeLightbox() {
        const lb = window.__avatarLB__;
        if (!lb) return;

        lb.overlay.style.display = 'none';
        lb.img.src = '';

        document.documentElement.style.overflow = __avatarPrevOverflow.html;
        document.body.style.overflow = __avatarPrevOverflow.body;
        document.body.style.paddingRight = __avatarPrevOverflow.paddingRight;
    }

    function bindEvents(lb) {
        lb.overlay.addEventListener('click', e => {
            if (e.target === lb.overlay) closeLightbox();
        });

        lb.closeBtn.addEventListener('click', closeLightbox);

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeLightbox();
        });
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', init)
        : init();
})();




// avatar_preview.js
(function () {
    'use strict';

    const form = document.getElementById('profileForm');
    if (!form) return;

    const saveBtn = form.querySelector('button[type="submit"]');

    const urlInput = document.getElementById('floatingAvatarProfile');
    const fileInput = document.getElementById('avatarFileInput');
    const fileTrigger = document.querySelector('.avatar-file-trigger');

    const urlPreview = document.getElementById('avatarUrlPreview');
    const filePreview = document.getElementById('avatarFilePreview');

    const urlImg = urlPreview.querySelector('img');
    const fileImg = filePreview.querySelector('img');
    const urlDeleteBtn = urlPreview.querySelector('.avatar-preview-delete');
    const fileDeleteBtn = filePreview.querySelector('.avatar-preview-delete');

    const fileNameBox = document.getElementById('avatarFileName');
    const clearFlag = document.getElementById('avatarClearFlag');

    const NOT_FOUND = '/static/img/image_not_found.webp';
    const ALLOWED_EXT = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

    /* ================== helpers ================== */

    function disableSave() {
        if (!saveBtn) return;
        if (!saveBtn.dataset.origText) {
            saveBtn.dataset.origText = saveBtn.textContent || '';
        }
        saveBtn.disabled = true;
        saveBtn.textContent = 'Blocked';
        saveBtn.classList.remove('custom-primary-btn');
        saveBtn.classList.add('custom-danger-btn');
    }

    function enableSave() {
        if (!saveBtn) return;
        saveBtn.disabled = false;
        if (saveBtn.dataset.origText) {
            saveBtn.textContent = saveBtn.dataset.origText;
        }
        saveBtn.classList.remove('custom-danger-btn');
        saveBtn.classList.add('custom-primary-btn');
    }

    function extractName(url) {
        return url ? url.split('/').pop().split('?')[0] : '';
    }

    function showFileName(name, isError = false) {
        if (!fileNameBox || !name) return;
        fileNameBox.textContent = name;
        fileNameBox.classList.remove('d-none');
        fileNameBox.classList.toggle('text-danger', isError);
    }

    function hideFileName() {
        if (!fileNameBox) return;
        fileNameBox.textContent = '';
        fileNameBox.classList.add('d-none');
    }

    function setClearFlag(val) {
        if (!clearFlag) return;
        clearFlag.value = val ? '1' : '0';
    }

    function clearAvatarSelection() {
        urlInput.value = '';
        if (fileInput) fileInput.value = '';
        urlPreview.classList.add('d-none');
        filePreview.classList.add('d-none');
        hideFileName();
        urlInput.classList.remove('is-invalid');
        setClearFlag(true);
        enableSave();
    }

    function showFile(src, name = null) {
        fileImg.src = src;
        filePreview.classList.remove('d-none');
        urlPreview.classList.add('d-none');
        showFileName(name || extractName(src));
        if (fileDeleteBtn) fileDeleteBtn.classList.remove('d-none');
        setClearFlag(false);
    }

    function showUrl(src) {
        urlImg.src = src;
        urlPreview.classList.remove('d-none');
        filePreview.classList.add('d-none');
        showFileName(extractName(src));
        if (urlDeleteBtn) urlDeleteBtn.classList.remove('d-none');
        setClearFlag(false);
    }

    function showInvalidUrl() {
        urlImg.src = NOT_FOUND;
        urlPreview.classList.remove('d-none');
        filePreview.classList.add('d-none');
        urlInput.classList.add('is-invalid');
        showFileName('Image not found', true);
        if (urlDeleteBtn) urlDeleteBtn.classList.add('d-none');
        // hideFileName();
        disableSave();
    }

    /* ================== initial avatar ================== */

    const initialAvatar = {
        type: null,   // 'file' | 'url'
        value: null,
        name: null
    };

    if (window.CURRENT_AVATAR?.file) {
        initialAvatar.type = 'file';
        initialAvatar.value = window.CURRENT_AVATAR.file;
        initialAvatar.name = extractName(window.CURRENT_AVATAR.file);
        showFile(initialAvatar.value, initialAvatar.name);
    }

    if (window.CURRENT_AVATAR?.url) {
        initialAvatar.type = 'url';
        initialAvatar.value = window.CURRENT_AVATAR.url;
        initialAvatar.name = extractName(window.CURRENT_AVATAR.url);
        showUrl(initialAvatar.value);
    }


    /* ================== reset ================== */

    function restoreInitialAvatar() {
        urlInput.classList.remove('is-invalid');
        urlPreview.classList.add('d-none');

        if (!initialAvatar.type) {
            hideFileName();
            enableSave();
            return;
        }

        if (initialAvatar.type === 'file') {
            showFile(initialAvatar.value, initialAvatar.name);
        } else {
            showUrl(initialAvatar.value);
        }

        enableSave();
    }

    /* ================== URL input ================== */

    let lastUrlValue = urlInput.value || '';
    urlInput.addEventListener('input', () => {
        const val = urlInput.value.trim();

        if (!val) {
            const hasFile = fileInput?.files?.length;
            if (!hasFile && lastUrlValue) {
                clearAvatarSelection();
            } else {
                urlPreview.classList.add('d-none');
                if (!hasFile) hideFileName();
                setClearFlag(!hasFile);
                urlInput.classList.remove('is-invalid');
                enableSave();
            }
            lastUrlValue = val;
            if (initialAvatar.type) {
                restoreInitialAvatar();
            }
            return;
        }

        try {
            new URL(val);
        } catch {
            showInvalidUrl();
            return;
        }

        if (!ALLOWED_EXT.test(val)) {
            showInvalidUrl();
            return;
        }

        const img = new Image();
        img.onload = () => {
            urlInput.classList.remove('is-invalid');
            showUrl(val);
            enableSave();
            lastUrlValue = val;
        };
        img.onerror = showInvalidUrl;
        img.src = val;
    });

    /* ================== File input ================== */

    if (fileTrigger && fileInput) {
        fileTrigger.addEventListener('click', () => fileInput.click());
    }

    fileInput?.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            initialAvatar.type = 'file';
            initialAvatar.value = e.target.result;
            initialAvatar.name = file.name;

            showFile(initialAvatar.value, initialAvatar.name);
            urlInput.value = '';
            urlInput.classList.remove('is-invalid');
            enableSave();
            lastUrlValue = '';
        };
        reader.readAsDataURL(file);
    });

    document.querySelectorAll('.avatar-preview-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            clearAvatarSelection();
        });
    });

    /* ================== submit guard ================== */

    form.addEventListener('submit', e => {
        if (urlInput.classList.contains('is-invalid')) {
            e.preventDefault();
            disableSave();
        }
    });

})();



// avatar_remove.js
(function () {
    'use strict';

    const overlay = document.querySelector('.avatar-remove-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', function () {
        fetch(this.dataset.url, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(res => res.json())
            .then(data => {
                if (!data.success) return;

                const username = overlay.dataset.username || '';
                const safeUser = (window.CSS && CSS.escape)
                    ? CSS.escape(username)
                    : username.replace(/["\\]/g, '\\$&');

                const selector = username
                    ? '.user-avatar[data-username="' + safeUser + '"]'
                    : '.user-avatar';

                // 🔁 ОБНОВЛЯЕМ АВАТАРЫ ТОЛЬКО ЭТОГО ПОЛЬЗОВАТЕЛЯ
                document.querySelectorAll(selector).forEach(img => {
                    img.src = data.default_avatar;
                    img.classList.add('no_avatar');
                    img.removeAttribute('data-full');
                });

                // убираем сегмент удаления
                overlay.remove();

                var profileHdr = document.querySelector(
                    '.profile-page-header[data-profile-username="' + safeUser + '"]'
                );
                if (profileHdr) {
                    profileHdr.querySelectorAll('.profile-mobile-avatar-thumb').forEach(function (btn) {
                        btn.remove();
                    });
                }
            });
    });

    function getCookie(name) {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith(name + '='))
            ?.split('=')[1];
    }
})();
// static/js/password_generator_register.js
document.addEventListener('DOMContentLoaded', function () {
    // IDs которые у тебя в шаблоне:
    const modalId = 'genPassModal';
    const genBtnId = 'genPassBtn';
    const generatedId = 'generatedPassword';
    const copyBtnId = 'copyPassBtn';
    const useBtnId = 'usePassBtn';

    // Попробуем найти поля паролей в форме регистрации (несколько fallback'ов)
    function findPassFieldPossibleIds() {
        const candidates = [
            'id_password1', 'id_password2',          // Django default
            'id_new_password1', 'id_new_password2',  // alternative used earlier
            'password1', 'password2'                 // fallback name-based
        ];
        const found = {};
        // Try by id
        candidates.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id.toLowerCase().includes('1')) found.p1 = el;
                if (id.toLowerCase().includes('2')) found.p2 = el;
            }
        });
        // if not found by id, try by name attribute
        if (!found.p1) {
            const byName = document.querySelector('input[name="password1"], input[name="new_password1"]');
            if (byName) found.p1 = byName;
        }
        if (!found.p2) {
            const byName2 = document.querySelector('input[name="password2"], input[name="new_password2"]');
            if (byName2) found.p2 = byName2;
        }
        return found;
    }

    const els = findPassFieldPossibleIds();
    const p1 = els.p1 || null;
    const p2 = els.p2 || null;

    const modalEl = document.getElementById(modalId);
    const genBtn = document.getElementById(genBtnId);
    const generatedEl = document.getElementById(generatedId);
    const copyBtn = document.getElementById(copyBtnId);
    const useBtn = document.getElementById(useBtnId);

    // --- Safety: переместим modal в body (если он не в body) ---
    if (modalEl && modalEl.parentNode !== document.body) {
        document.body.appendChild(modalEl);
    }

    // helper: сгенерировать пароль длиной n
    function randomPassword(n = 10) {
        // исключаем похожие символы O0I1l для читаемости
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+';
        let s = '';
        for (let i = 0; i < n; i++) {
            s += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return s;
    }

    // helper: show bootstrap modal instance
    function getModalInstance() {
        if (!modalEl) return null;
        let inst = null;
        try { inst = bootstrap.Modal.getInstance(modalEl); } catch (e) { inst = null; }
        if (!inst) {
            try { inst = new bootstrap.Modal(modalEl); } catch (e) { inst = null; }
        }
        return inst;
    }

    // Gen button click: generate + show modal
    if (genBtn && generatedEl && modalEl) {
        genBtn.addEventListener('click', function (e) {
            e.preventDefault();
            // длина может быть параметром — 12 хорошая длина для регистрации
            const pwd = randomPassword(12);
            generatedEl.textContent = pwd;

            const inst = getModalInstance();
            if (inst) inst.show();

            // фокус на Use this password
            setTimeout(() => {
                const toFocus = document.getElementById(useBtnId);
                if (toFocus) toFocus.focus();
            }, 200);
        });
    }

    // Copy to clipboard
    if (copyBtn && generatedEl) {
        copyBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            const txt = (generatedEl.textContent || '').trim();
            if (!txt) return;
            try {
                await navigator.clipboard.writeText(txt);
                const old = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                copyBtn.classList.remove('btn-success');
                copyBtn.classList.add('btn-secondary');
                setTimeout(() => {
                    copyBtn.textContent = old;
                    copyBtn.classList.remove('btn-secondary');
                    copyBtn.classList.add('btn-success');
                }, 1200);
            } catch (err) {
                // fallback
                const ta = document.createElement('textarea');
                ta.value = txt;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try { document.execCommand('copy'); copyBtn.textContent = 'Copied!'; } catch (ex) { /* ignore */ }
                ta.remove();
                setTimeout(() => copyBtn.textContent = 'Copy', 1200);
            }
        });
    }

    // Use this password -> вставляем в поля и закрываем modal
    if (useBtn && generatedEl) {
        useBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const txt = (generatedEl.textContent || '').trim();
            if (!txt) return;

            // вновь найдём поля (на случай динамики)
            const f = findPassFieldPossibleIds();
            const target1 = f.p1 || p1;
            const target2 = f.p2 || p2;

            if (target1) {
                target1.focus();
                target1.value = txt;
                // событие input для реактивных валидаторов
                target1.dispatchEvent(new Event('input', { bubbles: true }));
                target1.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (target2) {
                target2.value = txt;
                target2.dispatchEvent(new Event('input', { bubbles: true }));
                target2.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Закрыть модал
            const inst = getModalInstance();
            try { if (inst) inst.hide(); } catch (err) { console.error(err); }

            // Плавный фокус на кнопку submit формы регистрации (если есть)
            setTimeout(() => {
                const submitBtn = document.querySelector('form[action*="register"] [type="submit"], form#registerForm [type="submit"], form [name="registration_submit"], form [type="submit"]');
                if (submitBtn) submitBtn.focus();
            }, 180);
        });
    }

    // Accessibility: при закрытии модала вернуть фокус куда нужно
    if (modalEl) {
        modalEl.addEventListener('hidden.bs.modal', function () {
            // если вдруг фокус остался внутри скрытого контейнера — перенесём фокус на кнопку Gen.Pass
            try {
                if (document.activeElement && modalEl.contains(document.activeElement)) {
                    const fallback = document.getElementById(genBtnId) || document.querySelector('form [type="submit"]');
                    if (fallback) fallback.focus();
                    else document.body.focus();
                }
            } catch (e) { /* ignore */ }
        });
    }
});
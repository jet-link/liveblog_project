// static/js/forms_handler.js
(function () {
    'use strict';

    (function () {
        // safe escape that we will use internally
        function cssEscapeSafe(value) {
            value = String(value === undefined || value === null ? '' : value);
            if (window.CSS && typeof CSS.escape === 'function') {
                return CSS.escape(value);
            }
            // simple fallback: escape " and \ and special CSS selector characters and spaces
            return value.replace(/([ !"#$%&'()*+,.\/:;<=>?@\[\]^`{|}~\\])/g, '\\$1');
        }

        // create alias CSSescape if code expects it (backwards compat)
        if (typeof window.CSSescape === 'undefined') {
            window.CSSescape = cssEscapeSafe;
        }

        // expose helper for this module by attaching to window for now (or wrap in closure)
        window.__cssEscapeSafe = cssEscapeSafe;
    })();

    // ---------- CONFIG ----------
    const SELECTOR_FORMS = 'form[data-validate="true"], form[data-ajax="true"]';
    const CLASS_ERROR = 'is-invalid';
    const CLASS_ERROR_MSG = 'invalid-feedback';
    const ATTR_AJAX = 'data-ajax';
    const ATTR_VALIDATE = 'data-validate';

    // ---------- helpers ----------
    function getCookie(name) {
        const v = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
        return v ? decodeURIComponent(v.split('=')[1]) : null;
    }

    function createErrorNode(message) {
        const div = document.createElement('div');
        div.className = CLASS_ERROR_MSG;
        div.textContent = message;
        return div;
    }

    function clearFieldErrors(field) {
        try {
            field.classList.remove(CLASS_ERROR);
            // remove adjacent invalid-feedback nodes (only those created by us)
            const next = field.nextElementSibling;
            if (next && next.classList && next.classList.contains(CLASS_ERROR_MSG)) {
                next.remove();
            }
        } catch (e) { /* ignore */ }
    }

    function showFieldErrors(field, messages) {
        clearFieldErrors(field);
        try {
            field.classList.add(CLASS_ERROR);
            const node = createErrorNode(messages.join(' '));
            if (field.nextSibling) field.parentNode.insertBefore(node, field.nextSibling);
            else field.parentNode.appendChild(node);
        } catch (e) { /* ignore */ }
    }

    function showNonFieldErrors(container, messages) {
        let box = container.querySelector('.form-errors-global');
        if (!box) {
            box = document.createElement('div');
            box.className = 'form-errors-global custom-alert custom-alert-danger mb-2';
            box.setAttribute('data-auto-dismiss', '3000');
            container.insertBefore(box, container.firstChild);
        }
        box.innerHTML = messages.map(m => `<div>${m}</div>`).join('');
        if (window.initAutoDismiss) window.initAutoDismiss(box);
    }

    function clearGlobalErrors(form) {
        const box = form.querySelector('.form-errors-global');
        if (box) box.remove();
    }

    function findField(form, name) {
        // use safe css escaper
        const esc = (window.__cssEscapeSafe || window.CSSescape);
        const q1 = `[name="${esc(name)}"]`;
        const q2 = `[name="${esc(name)}[]"]`; // django-style arrays
        // try exact matches first
        let el = form.querySelector(q1) || form.querySelector(q2);
        if (el) return el;

        // try to find by attribute starts-with (handles names with [] or nested names)
        const all = Array.from(form.querySelectorAll('[name]'));
        for (let a of all) {
            if (a.getAttribute('name') === name) return a;
            if (a.getAttribute('name') === (name + '[]')) return a;
        }
        return null;
    }

    // ---------- Summernote sync helper ----------
    function syncSummernoteFields(form) {
        // jQuery + summernote
        if (window.jQuery && typeof window.jQuery.fn.summernote === 'function') {
            Array.from(form.querySelectorAll('textarea')).forEach(tx => {
                try {
                    const $tx = window.jQuery(tx);
                    if ($tx && typeof $tx.summernote === 'function' && $tx.next('.note-editor').length) {
                        const code = $tx.summernote('code') || '';
                        tx.value = code;
                    }
                } catch (err) {
                    // ignore
                }
            });
            return;
        }

        // non-jQuery fallback:
        // Copy content from .note-editable to nearest textarea (best-effort)
        const editors = form.querySelectorAll('.note-editable');
        editors.forEach(editable => {
            const editorWrap = editable.closest('.note-editor');
            if (!editorWrap) return;
            // usually the textarea is just before the .note-editor
            let tx = editorWrap.previousElementSibling;
            if (!tx || tx.tagName !== 'TEXTAREA') {
                // fallback: first empty textarea inside form
                const possible = Array.from(form.querySelectorAll('textarea'));
                tx = possible.find(t => !t.value) || possible[0] || null;
            }
            if (tx) {
                tx.value = editable.innerHTML || '';
            }
        });
    }

    // attach listeners to Summernote editors so that when user types we clear field errors
    function attachSummernoteListeners(form) {
        // jQuery summernote emits 'summernote.change' event
        if (window.jQuery && typeof window.jQuery.fn.summernote === 'function') {
            const $ = window.jQuery;
            $(form).find('textarea').each(function () {
                try {
                    const $t = $(this);
                    if ($t && typeof $t.summernote === 'function' && $t.next('.note-editor').length) {
                        $t.on('summernote.change', function (we, contents, $editable) {
                            // write back to textarea and clear errors for this field
                            $(this).val($t.summernote('code'));
                            // find field and clear errors
                            clearFieldErrors(this);
                        });
                    }
                } catch (e) { /* ignore */ }
            });
            return;
        }

        // non-jquery: listen to input events on editable area(s)
        const editables = form.querySelectorAll('.note-editable');
        editables.forEach(ed => {
            ed.addEventListener('input', function () {
                // try to find corresponding textarea and clear its errors
                const editorWrap = ed.closest('.note-editor');
                if (!editorWrap) return;
                let tx = editorWrap.previousElementSibling;
                if (!tx || tx.tagName !== 'TEXTAREA') {
                    const possible = Array.from(form.querySelectorAll('textarea'));
                    tx = possible.find(t => !t.value) || possible[0] || null;
                }
                if (tx) {
                    tx.value = ed.innerHTML || '';
                    clearFieldErrors(tx);
                }
            });
        });
    }

    // ---------- client validation ----------
    function validateForm(form) {
        // returns { valid: bool, errors: { field: [msg] , __all__: [msg] } }
        const res = { valid: true, errors: {} };

        // Built-in browser validation first:
        // check required fields
        const requiredFields = Array.from(form.querySelectorAll('[required]'));
        requiredFields.forEach(f => {
            // If field is hidden, skip (could still validate via server)
            if (f.type === 'hidden' || f.disabled) return;
            // For checkboxes/radios: at least one in group must be checked
            if (f.type === 'checkbox' || f.type === 'radio') {
                // if same name group, validate only once
                if (form.querySelectorAll(`[name="${CSSescape(f.name)}"]`)[0] !== f) return;
                const group = form.querySelectorAll(`[name="${CSSescape(f.name)}"]`);
                const any = Array.from(group).some(el => el.checked);
                if (!any) {
                    res.valid = false;
                    res.errors[f.name] = res.errors[f.name] || [];
                    res.errors[f.name].push('This field is required.');
                }
                return;
            }
            // For file inputs: ensure files.length > 0
            if (f.type === 'file') {
                if (!f.files || f.files.length === 0) {
                    res.valid = false;
                    res.errors[f.name] = res.errors[f.name] || [];
                    res.errors[f.name].push('Please select a file.');
                }
                return;
            }
            // For text-like:
            if (String(f.value || '').trim() === '') {
                res.valid = false;
                res.errors[f.name] = res.errors[f.name] || [];
                res.errors[f.name].push('This field is required.');
            }
        });

        // Additional custom HTML attributes can be handled here,
        // e.g. data-minlength, pattern etc. (left extensible)
        // Example: data-minlength
        const minEls = Array.from(form.querySelectorAll('[data-minlength]'));
        minEls.forEach(el => {
            const n = Number(el.getAttribute('data-minlength') || 0);
            if ((el.value || '').length < n) {
                res.valid = false;
                res.errors[el.name] = res.errors[el.name] || [];
                res.errors[el.name].push(`Minimum length is ${n} characters.`);
            }
        });

        return res;
    }

    // ---------- AJAX submit ----------
    async function submitFormAjax(form) {
        clearGlobalErrors(form);
        // build FormData (will include files)
        const fd = new FormData(form);

        const url = form.getAttribute('action') || window.location.href;
        const method = (form.getAttribute('method') || 'POST').toUpperCase();

        const headers = {
            'X-Requested-With': 'XMLHttpRequest',
        };
        // add CSRF if needed
        const csrftoken = getCookie('csrftoken');
        if (csrftoken) headers['X-CSRFToken'] = csrftoken;

        // optional: allow a custom before-send hook: form.dispatchEvent(new CustomEvent('before-ajax', {detail:{fd}}))
        try {
            const resp = await fetch(url, {
                method,
                headers,
                body: fd,
                credentials: 'same-origin',
            });

            const contentType = resp.headers.get('content-type') || '';
            // try parse JSON if possible
            let data = null;
            if (contentType.indexOf('application/json') !== -1) {
                data = await resp.json().catch(() => null);
            } else {
                // if server returns HTML on success, try to parse as text
                data = await resp.text().catch(() => null);
            }

            if (!resp.ok) {
                // handle 400 with JSON errors
                if (resp.status === 400 && data && data.errors) {
                    showServerErrors(form, data.errors);
                } else if (resp.status === 429) {
                    const msg = (data && data.error) ? data.error : 'Too many requests';
                    showNonFieldErrors(form, [msg]);
                } else {
                    showNonFieldErrors(form, ['Server error. Try again.']);
                }
                return { ok: false, resp, data };
            }

            // success
            if (data && data.success) {
                // if server asks to redirect:
                if (data.redirect) {
                    window.location.href = data.redirect;
                    return { ok: true, data };
                }
                // if server returns updated html part or message, we can dispatch event
                form.dispatchEvent(new CustomEvent('ajax:success', { detail: { data } }));
                return { ok: true, data };
            } else {
                // maybe server returned errors payload
                if (data && data.errors) {
                    showServerErrors(form, data.errors);
                } else {
                    showNonFieldErrors(form, ['Unknown server response.']);
                }
                return { ok: false, data };
            }
        } catch (err) {
            console.error('AJAX submit error', err);
            showNonFieldErrors(form, ['Network error. Try again.']);
            return { ok: false, error: err };
        }
    }

    function showServerErrors(form, errors) {
        clearGlobalErrors(form);
        // errors = { field: ["msg1","msg2"], "__all__": ["..."] }
        Object.keys(errors).forEach(k => {
            if (k === '__all__' || k === 'non_field_errors') {
                showNonFieldErrors(form, errors[k]);
            } else {
                const field = findField(form, k);
                if (field) {
                    showFieldErrors(field, errors[k]);
                } else {
                    // fallback: show as global
                    showNonFieldErrors(form, errors[k]);
                }
            }
        });
    }

    // ---------- main init ----------
    function init() {
        const forms = Array.from(document.querySelectorAll(SELECTOR_FORMS));
        if (!forms.length) return;

        forms.forEach(form => {
            // avoid attaching listeners twice (pageshow + DOMContentLoaded can both run)
            if (form.dataset.fhInit === '1') return;
            form.dataset.fhInit = '1';

            // attach summernote listeners (if present) to keep textarea synced and clear errors on change
            try {
                attachSummernoteListeners(form);
            } catch (e) {
                // ignore
            }

            // on input change — clear error for this field
            form.addEventListener('input', function (ev) {
                const t = ev.target;
                if (!t) return;
                clearFieldErrors(t);
            });

            // intercept submit
            form.addEventListener('submit', async function (ev) {
                // client validation
                if (!form.hasAttribute(ATTR_VALIDATE) && !form.hasAttribute(ATTR_AJAX)) {
                    // not managed by us
                    return;
                }

                ev.preventDefault();

                // clear previous errors
                clearGlobalErrors(form);
                Array.from(form.elements).forEach(el => clearFieldErrors(el));

                // --- SYNCHRONIZE WYSIWYG (summernote) -> underlying textarea (if any) ---
                try {
                    syncSummernoteFields(form);
                } catch (e) {
                    // ignore sync failures; validation will still run
                }

                const v = validateForm(form);
                if (!v.valid) {
                    Object.keys(v.errors).forEach(fn => {
                        const fld = findField(form, fn);
                        if (fld) showFieldErrors(fld, v.errors[fn]);
                        else showNonFieldErrors(form, v.errors[fn]);
                    });


                    // Smooth anchor scroll к первому invalid полю
                    const firstFieldName = Object.keys(v.errors)[0];
                    const firstField = findField(form, firstFieldName);
                    if (firstField) {

                        firstField.scrollIntoView({
                            behavior: 'auto',
                            block: 'center'
                        });

                        setTimeout(() => firstField.focus(), 300);
                    }
                    return;
                }

                // Guard: prevent double-submits (disable submit buttons immediately)
                // BUT: we must preserve the submit button that actually triggered the submit
                // Use ev.submitter if available (modern browsers). Fallback: try document.activeElement.
                const submitter = ev.submitter || document.activeElement;
                const submitBtns = Array.from(form.querySelectorAll('[type="submit"], button[data-submit]'));

                // Disable all submit buttons EXCEPT the real submitter (to preserve its name/value)
                submitBtns.forEach(b => {
                    try {
                        if (b !== submitter) b.disabled = true;
                    } catch (e) { /* ignore */ }
                });

                // If form is AJAX-handled -> send via fetch and stay on page
                if (form.hasAttribute(ATTR_AJAX)) {
                    const result = await submitFormAjax(form);
                    // re-enable all submits after AJAX result
                    submitBtns.forEach(b => { try { b.disabled = false; } catch (e) { } });
                    return;
                }

                // Not AJAX — we will submit the form normally.
                // BUT: some browsers don't include the clicked button name/value if we call form.submit()
                // even if it's not disabled. To be safe, if submitter has a name, insert a hidden input with same name/value.
                try {
                    if (submitter && submitter.name) {
                        // create temporary hidden input to ensure name/value are posted
                        const hid = document.createElement('input');
                        hid.type = 'hidden';
                        hid.name = submitter.name;
                        // use value if available, otherwise keep empty string
                        hid.value = submitter.value || '';
                        // mark to remove later
                        hid.dataset.__temp_submit = '1';
                        form.appendChild(hid);

                        // Submit and then remove the temp input after a tiny timeout (to be safe).
                        form.submit();

                        setTimeout(() => {
                            try {
                                const t = form.querySelector('input[data-__temp_submit="1"]');
                                if (t) t.remove();
                            } catch (e) { }
                        }, 5000);
                        return;
                    }
                } catch (err) {
                    // if anything fails fall back to direct submit
                    console.warn('Falling back to direct form.submit()', err);
                }

                // fallback: direct submit
                form.submit();
            });
        });
    }

    // run on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', init);
    // also run on page:load (for bfcache)
    window.addEventListener('pageshow', init);

})();



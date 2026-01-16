(function () {
    'use strict';

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
        field.classList.remove(CLASS_ERROR);
        // remove adjacent invalid-feedback nodes (only those created by us)
        const next = field.nextElementSibling;
        if (next && next.classList && next.classList.contains(CLASS_ERROR_MSG)) {
            next.remove();
        }
    }

    function showFieldErrors(field, messages) {
        clearFieldErrors(field);
        field.classList.add(CLASS_ERROR);
        // append messages (first one)
        const node = createErrorNode(messages.join(' '));
        if (field.nextSibling) field.parentNode.insertBefore(node, field.nextSibling);
        else field.parentNode.appendChild(node);
    }

    function showNonFieldErrors(container, messages) {
        // container: form element
        // find or create a top-level errors container
        let box = container.querySelector('.form-errors-global');
        if (!box) {
            box = document.createElement('div');
            box.className = 'form-errors-global alert alert-danger';
            container.insertBefore(box, container.firstChild);
        }
        box.innerHTML = messages.map(m => `<div>${m}</div>`).join('');
    }

    function clearGlobalErrors(form) {
        const box = form.querySelector('.form-errors-global');
        if (box) box.remove();
    }

    function findField(form, name) {
        // handles <input name="x"> and django-like names "field" or "field[]"/nested
        return form.querySelector(`[name="${CSSescape(name)}"], [name="${CSSescape(name)}[]"]`);
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

                const v = validateForm(form);
                if (!v.valid) {
                    // Show errors
                    Object.keys(v.errors).forEach(fn => {
                        const fld = findField(form, fn);
                        if (fld) showFieldErrors(fld, v.errors[fn]);
                        else showNonFieldErrors(form, v.errors[fn]);
                    });
                    // focus first invalid field
                    const firstFieldName = Object.keys(v.errors)[0];
                    const firstField = findField(form, firstFieldName);
                    if (firstField) firstField.focus();
                    return;
                }

                // if ajax -> send via fetch and stay on page
                if (form.hasAttribute(ATTR_AJAX)) {
                    // disable submit buttons
                    const submitBtns = Array.from(form.querySelectorAll('[type="submit"], button[data-submit]'));
                    submitBtns.forEach(b => b.disabled = true);

                    const result = await submitFormAjax(form);

                    submitBtns.forEach(b => b.disabled = false);

                    // if server returned redirect in success, the page will change
                    // else you can handle 'ajax:success' event on form for custom UI update
                    return;
                }

                // not ajax and valid -> allow normal submit
                form.submit();
            });
        });
    }

    // run on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', init);
    // also run on page:load (for bfcache)
    window.addEventListener('pageshow', init);

})();
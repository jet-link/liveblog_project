/**
 * Admin panel CKEditor - height 400-500px, scrollable, heading styles, form validation fix
 */
document.addEventListener('DOMContentLoaded', function () {
  var editors = document.querySelectorAll('.admin-form .ckeditor');
  var form = document.querySelector('.admin-form');
  if (form) form.setAttribute('novalidate', 'novalidate');

  editors.forEach(function (el) {
    if (typeof ClassicEditor === 'undefined') return;
    ClassicEditor
      .create(el, {
        toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', '|', 'blockQuote', 'undo', 'redo']
      })
      .then(function (editor) {
        var editable = editor.ui.getEditableElement();
        if (editable) {
          editable.style.minHeight = '450px';
          editable.style.maxHeight = '450px';
          editable.style.overflowY = 'auto';
          editable.setAttribute('spellcheck', 'true');
          var langEl = editable.closest('[data-spellcheck-lang]');
          var lang = langEl ? langEl.getAttribute('data-spellcheck-lang') : (document.documentElement.getAttribute('lang') || 'en');
          editable.setAttribute('lang', lang);
        }
      })
      .catch(function (err) { console.error(err); });
  });
});

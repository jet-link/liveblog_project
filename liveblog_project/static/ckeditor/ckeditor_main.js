document.addEventListener('DOMContentLoaded', function () {
	const editors = document.querySelectorAll('.ckeditor');

	editors.forEach(el => {
		ClassicEditor
			.create(el, {
				toolbar: [
					'heading',
					'|',
					'bold',
					'italic',
					'link',
					'bulletedList',
					'numberedList',
					'|',
					'blockQuote',
					'undo',
					'redo'
				]
			})
			.then(editor => {
				const textareaId = el.id;
				const editable = editor.ui?.getEditableElement?.() || editor.ui?.view?.editableElement;
				if (editable) {
					editable.setAttribute('spellcheck', 'true');
					const langEl = editable.closest('[data-spellcheck-lang]');
					const lang = langEl ? langEl.getAttribute('data-spellcheck-lang') : (document.documentElement.getAttribute('lang') || 'ru');
					editable.setAttribute('lang', lang);
				}
				if (!textareaId) return;
				let attempts = 0;
				const tryFix = () => {
					const editEl = editor.ui?.getEditableElement?.() || editor.ui?.view?.editableElement;
					const editorRoot = editEl ? editEl.closest('.ck-editor') : el.parentElement?.querySelector('.ck-editor');
					const label = editorRoot?.querySelector('.ck-voice-label');
					if (label) {
						label.setAttribute('for', textareaId);
					} else if (attempts++ < 50) {
						requestAnimationFrame(tryFix);
					}
				};
				tryFix();
			})
			.catch(error => {
				console.error(error);
			});
	});
});
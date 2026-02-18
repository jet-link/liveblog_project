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
				if (!textareaId) return;
				let attempts = 0;
				const tryFix = () => {
					const editable = editor.ui?.getEditableElement?.() || editor.ui?.view?.editableElement;
					const editorRoot = editable ? editable.closest('.ck-editor') : el.parentElement?.querySelector('.ck-editor');
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
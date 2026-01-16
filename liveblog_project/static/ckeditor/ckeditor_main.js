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
			.catch(error => {
				console.error(error);
			});
	});
});
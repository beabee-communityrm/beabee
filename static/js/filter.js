/* global $, window */

$('input[name="members[]"]').click(function (evt) {
	evt.stopPropagation();
});

$('tr[data-href]').click(function (evt) {
	var href = this.getAttribute('data-href');
	if (evt.ctrlKey) {
		window.open(href, '_blank');
	} else {
		window.document.location = href;
	}
});

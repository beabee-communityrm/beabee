/* global $, window */

$('tr[data-href]').click(function (evt) {
	var href = this.getAttribute('data-href');
	if (evt.ctrlKey) {
		window.open(href, '_blank');
	} else {
		window.document.location = href;
	}
});

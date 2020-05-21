/* global $, window */

$('tr[data-href]').click(function () {
	window.document.location = this.getAttribute('data-href');
});

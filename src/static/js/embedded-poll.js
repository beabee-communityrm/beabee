/* global document, Formio, window */

(function () {
	var formEl = document.getElementById('pollForm');
	Formio.createForm(
		document.getElementById('pollFields'),
		window.pollSchema,
		{
			template: 'bootstrap3',
			noAlerts: true
		}
	).then(function (form) {
		formEl.addEventListener('submit', function (evt) {
			evt.preventDefault();
			form.submit();
		});
		form.on('submit', function () {
			formEl.submit();
		});
	});
})();

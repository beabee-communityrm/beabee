/* global $, stripe */

(function () {
	var $form = $('.js-gift-form');
	var $errors = $('.js-gift-errors');

	$form.on('submit', function (evt) {
		evt.preventDefault();

		$.ajax({
			url: '/gift',
			type: 'POST',
			data: $form.serialize(),
			success: function (data) {
				stripe.redirectToCheckout({
					sessionId: data.sessionId
				});
			},
			error: function (xhr) {
				var errors;
				try {
					errors = JSON.parse(xhr.responseText);
				} catch (err) {
					errors = ['An unknown error occured, please contact membership@thebristolcable.org'];
				}

				const errorHTML = errors
					.map(function (error) {
						return '<div class="alert alert-danger">' + error + '</div>';
					})
					.join('');

				$errors.html(errorHTML);
				$errors.get(0).scrollIntoView();
			}
		});
	});
})();

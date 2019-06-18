(function () {
	const $newAmount = $('.js-new-amount');
	const oldAmount = Number($newAmount.val());
	const monthsLeft = Number($('.js-new-amount-more').data('months'));

	$newAmount.on('change', function () {
		const newAmount = Number($newAmount.val());

		$('.js-new-amount-annual').text(newAmount * 12);
		$('.js-new-amount-less').toggleClass('hidden', newAmount >= oldAmount);
		$('.js-new-amount-more').toggleClass('hidden', newAmount <= oldAmount);
		$('.js-new-amount-btn').prop('disabled', newAmount === oldAmount);

		const oldAmountProrate = oldAmount * monthsLeft;
		const newAmountProrate = newAmount * monthsLeft;
		$('.js-new-amount-prorated-old').text(oldAmountProrate);
		$('.js-new-amount-prorated-new').text(newAmountProrate);
		$('.js-new-amount-prorated').text(newAmountProrate - oldAmountProrate);
	});

	$('.js-new-amount-prorated-toggle').on('click', function (evt) {
		evt.preventDefault();
		$('.js-new-amount-prorated-calc').toggleClass('hidden');
	});

	$('.js-new-amount-btn').prop('disabled', true);
})();

/* global $ */

(function () {
	var $form = $('.js-update-form');

	var oldAmount = Number($form.data('amount'));
	var monthsLeft = Number($form.data('months'));
	var isActive = $form.data('active') !== undefined;
	var nextPayment = $form.data('next');

	var oldAmountProrate = oldAmount * monthsLeft;

	$('.js-update-form').on('change input', function () {
		var newAmount = Number($form.find('input[name=amount]').val());
		var period = $form.find('input[name=period]:checked').val();

		var isProrated = newAmount > oldAmount && $form.find('input[name=prorate]:checked').val() === 'true';
		var newActualAmount = newAmount * (period === 'monthly' ? 1 : 12);

		$('.js-new-amount').text(newAmount);
		$('.js-new-amount-annual').text(newAmount * 12);
		$('.js-new-amount-more').toggleClass('hidden', newAmount <= oldAmount);

		if (isProrated) {
			var newAmountProrate = newAmount * monthsLeft;
			var amountProrated = newAmountProrate - oldAmountProrate;
			$('.js-new-amount-prorated-new').text(newAmountProrate);
			$('.js-new-amount-prorated').text(amountProrated);
		}

		var chargeMessage = 'You will be charged ';

		var chargedToday = !isActive ? newActualAmount : isProrated ? amountProrated : 0;
		if (chargedToday) {
			chargeMessage += 'charged £' + chargedToday + ' today';
		}

		if (isActive) {
			chargeMessage += (isProrated ? ' and ' : '') +
				'£' + newActualAmount + '/' + (period === 'monthly' ? 'month' : 'year') + ' from ' + nextPayment;
		}

		chargeMessage += '.';

		$('.js-new-charge').removeClass('hidden');
		$('.js-new-charge-message').text(chargeMessage);
	});

	$('.js-new-amount-prorated-toggle').on('click', function (evt) {
		evt.preventDefault();
		$('.js-new-amount-prorated-calc').toggleClass('hidden');
	});
})();

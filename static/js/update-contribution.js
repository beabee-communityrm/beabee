/* global $ */

(function () {
	var $form = $('.js-update-form');
	var $amount = $form.find('input[name=amount]');
	var $payFee = $form.find('input[name=payFee]');
	var $period = $form.find('input[name=period]');
	var $prorate = $form.find('input[name=prorate]');

	var oldAmount = Number($form.data('amount'));
	var monthsLeft = Number($form.data('months'));
	var isActive = $form.data('active') !== undefined;
	var isPayingFee = $form.data('paying-fee') !== undefined;
	var nextPayment = $form.data('next');

	var oldAmountProrate = oldAmount * monthsLeft;

	var canForceFee = isPayingFee || !isActive;

	function updateUI() {
		var newAmount = Number($amount.val());
		var period = $period.filter('[type=hidden], [type=radio]:checked').val();

		var isAnnual = period === 'annually';
		var isProrating = newAmount > oldAmount && $prorate.filter(':checked').val() === 'true';
		var newActualAmount = newAmount * (isAnnual ? 12 : 1);
		var fee = (Math.floor(newActualAmount / 0.99 * 100) + 20) / 100 - newActualAmount;

		$payFee.prop('disabled', isAnnual).prop('readOnly', canForceFee && newActualAmount === 1);
		if (canForceFee && newActualAmount === 1) {
			$payFee.filter('[value=true]').prop('checked', true);
		}
		$('.js-new-fee').toggleClass('hidden', isAnnual);

		var newIsPayingFee = $payFee.filter(':checked:enabled').val() === 'true';

		$('.js-new-amount').text(newAmount);
		$('.js-new-amount-annual').text(newAmount * 12);
		$('.js-new-amount-more').toggleClass('hidden', newAmount <= oldAmount);
		$('.js-new-fee-amount').text(Math.round(fee * 100) + 'p');

		var chargeableAmount = newIsPayingFee ? newActualAmount + fee : newActualAmount;
		var repeatedChargeMessage = '£' + chargeableAmount.toFixed(2) + '/' + (isAnnual ? 'year' : 'month');

		var chargeMessage = 'You will be charged ';
		if (isActive) {
			if (isProrating) {
				var newAmountProrate = newAmount * monthsLeft;
				var proratedAmount = newAmountProrate - oldAmountProrate;
				$('.js-new-amount-prorated-new').text(newAmountProrate);
				$('.js-new-amount-prorated').text(proratedAmount);
				chargeMessage += 'charged £' + proratedAmount.toFixed(2) + ' today and ';
			}
			chargeMessage += repeatedChargeMessage + ' from ' + nextPayment;
		} else {
			chargeMessage += repeatedChargeMessage;
		}

		$('.js-new-charge').text(chargeMessage + '.');
	}

	$form.on('change input', function () {
		updateUI();
		$('.js-new-charge').removeClass('hidden');
	});

	updateUI();

	$('.js-new-amount-prorated-toggle').on('click', function (evt) {
		evt.preventDefault();
		$('.js-new-amount-prorated-calc').toggleClass('hidden');
	});

	$('.js-new-fee-toggle').on('click', function (evt) {
		evt.preventDefault();
		$('.js-new-fee-explainer').toggleClass('hidden');
	});
})();

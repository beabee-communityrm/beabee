/* global $, _paq */

(function () {
	var $form = $('.js-join-form');
	var $formMore = $form.find('.js-join-form-more');
	var $sustain = $form.find('.js-join-sustain');

	var $amount = $form.find('.js-join-amount');
	var $otherAmount = $form.find('.js-join-other-amount');
	var $otherAmountBox = $form.find('.js-join-other-amount-box');
	var $period = $form.find('.js-join-period');

	var $gift = $form.find('.js-gift');
	var $giftNote = $form.find('.js-gift-note');
	var $giftDetails = $form.find('.js-gift-details');

	var $fee = $form.find('.js-join-fee');
	var $feeOpt = $form.find('.js-join-fee-opt');
	var $feeForce = $form.find('.js-join-fee-force');
	var $feeAmount = $form.find('.js-join-fee-amount');
	var $payFee = $form.find('.js-join-pay-fee');

	var $charge = $form.find('.js-join-charge');

	var $jtjImg = $('.js-jtj-mug-img');
	var $jtjMugOptionValue = $('.js-jtj-mug-option-value');

	$form.on('change input', function () {
		var amount = $amount.filter(':checked').val();
		var period = $period.filter(':checked').val();
		var gift = $gift.filter(':checked').val();

		$otherAmountBox.prop('required', amount === undefined);

		if (!amount) {
			amount = $otherAmountBox.val();
		}

		var isAnnual = period === 'annually';
		var actualAmount = amount * (isAnnual ? 12 : 1);
		var fee = (Math.floor(actualAmount / 0.99 * 100) + 20) / 100 - actualAmount;

		$payFee.prop('disabled', isAnnual).prop('readOnly', actualAmount === 1);
		if (actualAmount === 1) {
			$payFee.prop('checked', true);
		}
		$fee.toggleClass('hidden', isAnnual);

		if (amount) {
			$formMore.removeClass('hidden-js');

			$sustain.toggleClass('hidden', amount >= 3);

			$gift
				.prop('disabled', function () {
					return amount < $(this).data('amount');
				})
				.prop('checked', function (i, val) {
					if (amount < $(this).data('amount'))
						return false;
					else
						return val;
				});

			$giftNote.each(function () {
				$(this).toggleClass('hidden', amount >= $(this).data('amount'));
			});

			$feeAmount.text(Math.round(fee * 100) + 'p');
			$feeOpt.toggleClass('hidden', actualAmount === 1);
			$feeForce.toggleClass('hidden', actualAmount > 1);

			var chargeableAmount = $payFee.is(':checked:enabled') ? actualAmount + fee : actualAmount;
			$charge.text('£' + chargeableAmount.toFixed(2) + '/' + (isAnnual ? 'year' : 'month'));
		} else {
			$feeAmount.text('??p');
			$feeOpt.removeClass('hidden');
			$feeForce.addClass('hidden');
			$charge.text('£?');
		}

		$giftDetails.each(function () {
			var $this = $(this);
			var isActive = $this.data('id') === gift;
			$this.toggleClass('hidden', !isActive);
			$this.find('input').prop('disabled', !isActive).prop('required', isActive);
		});
	});

	$form.on('submit', function () {
		_paq.push(['trackGoal', 2]);
	});

	$otherAmountBox.on('focus', function () {
		$amount.prop('checked', false);
		$otherAmount.prop('checked', true);
		$form.trigger('change');
	});

	$amount.on('change', function () {
		$otherAmountBox.val('');
	});

	$jtjMugOptionValue.on('change input', function () {
		$jtjImg.attr('src', $jtjMugOptionValue.filter(':checked').data('img'));
	});

	$otherAmount.prop('checked', false);
	$form.trigger('change');

})();

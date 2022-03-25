/* global $, mailing */
(function () {
	let recipientNo = 0;

	function getField(field, def) {
		var value = $(field).val();
		return value ? mailing.recipients[recipientNo][value] : def;
	}

	function updatePreview() {
		$('.js-email-to').val(getField('#name', 'Name') + ' <' + getField('#email', 'Email address') + '>');
		var emailBody = $('.js-email-template').html();
		for (var mergeField of mailing.mergeFields) {
			const mergeFieldRe = new RegExp('\\*\\|' + mergeField + '\\|\\*', 'g');
			emailBody = emailBody.replace(mergeFieldRe, getField('#mf_' + mergeField, '*|' + mergeField + '|*'));
		}
		$('.js-email-body').html(emailBody);
	}

	$('.js-email-form').on('input change', updatePreview());
	$('.js-step-recipient').click(function () {
		recipientNo = Math.max(0, Math.min(mailing.recipients.length - 1, recipientNo + Number(this.value)));
		$('.js-recipient-no').text(recipientNo + 1);
		updatePreview();
	});

	updatePreview();
})();

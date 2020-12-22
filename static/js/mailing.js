/* global $, mailing */
(function () {
	function getField(field, def) {
		var value = $(field).val();
		console.log(value);
		return value ? mailing.recipient[value] : def;
	}

	$('.js-email-form').on('input change', function () {
		$('.js-email-to').val(getField('#name', 'Name') + ' <' + getField('#email', 'Email address') + '>');
		var emailBody = mailing.emailBodyTemplate;
		for (var mergeField of mailing.mergeFields) {
			const mergeFieldRe = new RegExp('\\*\\|' + mergeField + '\\|\\*', 'g');
			emailBody = emailBody.replace(mergeFieldRe, getField('#mf_' + mergeField, '*|' + mergeField + '|*'));
		}
		$('.js-email-body').val(emailBody);
	});

	$('.js-email-form').trigger('input');
})();

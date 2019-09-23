/* global $ */

(function () {
	var $candidates = $('.js-poll-directors2019-candidate');
	var $submit = $('.js-poll-directors2019-submit');

	function update() {
		var votes = $candidates.filter(':checked').length;
		$submit.prop('disabled', votes < 1 || votes > 3);
		$candidates.filter(':not(:checked)').prop('disabled', votes >= 3);
	}

	$candidates.on('input', update);
	update();
})();

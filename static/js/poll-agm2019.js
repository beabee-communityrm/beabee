/* global $ */

(function () {
	var $form = $('.js-poll-agm2019-form');

	$('.js-poll-agm2019-section').each(function () {
		var $section = $(this);
		var name = $section.data('name');
		var value = $section.data('value');
		var $input = $form.find('input[name=' + name + ']');

		function check() {
			const hidden = !(this.value === value && this.checked);
			$section.toggleClass('hidden', hidden);
			$section.find('input').prop('disabled', hidden);
		}

		$input.on('input', check);
		$input.trigger('input');
	});
})();

/* global $, window */

(function () {
	var $form = $('.js-poll-agm2019-form');
	var $formAnswer = $form.find('input[name=answer]');
	var $submit = $('.js-poll-agm2019-submit');

	if (/answer=/.test(window.location.search)) {
		var answer = window.location.search.substring(8);
		$formAnswer.filter('[value=' + answer + ']').prop('checked', true);
	}

	$('.js-poll-agm2019-section').each(function () {
		var $section = $(this);
		var name = $section.data('name');
		var value = $section.data('value');
		var $input = $form.find('input[name=' + name + ']');

		function updateSection() {
			const hidden = $input.filter(':checked').val() !== value;
			$section.toggleClass('hidden', hidden);
			$section.find('input').prop('disabled', hidden);
		}

		$input.on('input', updateSection);
		updateSection();
	});

	function updateSubmit() {
		$submit.prop('disabled', $formAnswer.filter(':checked').length === 0);
	}

	$formAnswer.on('input', updateSubmit);
	updateSubmit();

	$formAnswer.on('input', function () {
		$.ajax({
			url: window.location.href,
			type: 'POST',
			data: {
				_csrf: $form.find('input[name=_csrf]').val(),
				answer: $formAnswer.filter(':checked').val(),
				isAsync: true
			}
		});
	});
})();

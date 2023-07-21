/* global $ */
(function () {
	$('.js-edit-member').each(function () {
		var isEditing = false;
		var $form = $(this);

		var oldState;
		$form.on('click', '.js-edit-member-toggle', function () {
			isEditing = !isEditing;

			if (isEditing) {
				oldState = $form.html();
			} else {
				$form.html(oldState);
			}

			$form.find('input[name], textarea[name]').prop('readonly', !isEditing);
			$form.find('select[name]').prop('disabled', !isEditing);
			$form.find('.js-edit-member-hidden').toggleClass('hidden', !isEditing);
		});
	});
})();

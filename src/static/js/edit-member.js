/* global $ */
(function () {
	var tagTemplate = $('.js-edit-member-tag-template').html();

	$('.js-edit-member').each(function () {
		var isEditing = false;
		var $form = $(this);

		var oldState;
		$form.on('click', '.js-edit-member-toggle', function () {
			isEditing = !isEditing;

			if (isEditing) {
				oldState = $form.html();
				$form.find('.js-edit-member-add-tag').attr('selectedIndex', 0);
			} else {
				$form.html(oldState);
			}

			$form.toggleClass('is-editing', isEditing)
			$form.find('input[name], textarea[name]').prop('readonly', !isEditing);
			$form.find('select[name]').prop('disabled', !isEditing);
			$form.find('.js-edit-member-hidden').toggleClass('hidden', !isEditing);
		});

		// Remove tags
		$form.on('click', '.js-edit-member-tag', function (evt) {
			if (isEditing) {
				evt.preventDefault();
				this.parentNode.removeChild(this);
			}
		});

		// Add tag
		$form.on('change', '.js-edit-member-add-tag', function () {
			var newTag = this.value;
			$form.find('.js-edit-member-tags').append(tagTemplate.replace(/XXX/g, newTag));
			this.selectedIndex = 0;
		});
	});
})();

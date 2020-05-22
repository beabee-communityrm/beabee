/* global $ */
(function () {
	var $tags = $('.js-edit-member-tags');

	$('.js-edit-member').click(function (evt) {
		evt.preventDefault();
		var $form = $('.js-edit-member-form' + this.getAttribute('href'));
		$form.find('input[name], textarea[name]').prop('readonly', (i, val) => !val);
		$form.find('.js-edit-member-hidden').toggleClass('hidden');
	});

	$tags.on('click', '.member-tag', function () {
		this.parentNode.removeChild(this);
	});

	$('.js-edit-member-add-tag-btn').click(function () {
		var newTag = $('.js-edit-member-add-tag').val();
		$tags.append($([
			'<span class="label label-info member-tag">',
			'<input type="hidden" name="tags[]" value="' + newTag + '">',
			newTag,
			'<span class="glyphicon glyphicon-remove js-edit-member-hidden"></span>',
			'</span>'
		].join('')));
	});
})();

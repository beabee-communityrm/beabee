/* global $ */

$('.js-member-edit').click(function (evt) {
	evt.preventDefault();
	var $form = $('.js-member-edit-form' + this.getAttribute('href'));
	$form.find('input, textarea').prop('readonly', (i, val) => !val);
	$form.find('.js-member-edit-btn').toggleClass('hidden');
});

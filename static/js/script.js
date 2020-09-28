/* global $, document */

// Reveal with form input disabler
(function () {
	$(document.body).on('input', '.js-reveal-types', function () {
		var $revealTypes = $(this);
		var $parent = $revealTypes.parents('.js-reveal');
		var $revealType = $parent.find('.js-reveal-type');

		var currentType = $revealTypes.val();

		$revealType.each(function () {
			var hidden = this.getAttribute('data-type') !== currentType;
			$(this).toggleClass('hidden', hidden);
			$(this).find('input, select, textarea').prop('disabled', hidden);
		});
	});
})();

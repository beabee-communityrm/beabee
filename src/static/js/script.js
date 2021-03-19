/* global $, document */

(function () {
	// Reveal with form input disabler
	$(document.body).on('input', '.js-reveal-types', function () {
		var $revealTypes = $(this);
		var $parent = $revealTypes.parents('.js-reveal').eq(0);

		var $revealType = $parent.find('.js-reveal-type').filter(function() {
			// Filter for those that aren't part of a nested reveal
			return $(this).parents('.js-reveal').get(0) === $parent.get(0);
		});

		if ($revealTypes.is(':radio') && !$revealTypes.prop('checked')) {
			return;
		}

		var currentType = $revealTypes.is(':checkbox') ?
			($revealTypes.prop('checked') ? $revealTypes.prop('name') : undefined) :
			$revealTypes.val();

		$revealType.each(function () {
			var hidden = this.getAttribute('data-type').split('|').indexOf(currentType) === -1;
			if (this.hasAttribute('data-inverse')) {
				hidden = !hidden;
			}
			$(this).toggleClass('hidden', hidden);
			$(this).find('input, select, textarea').prop('disabled', hidden);
		});
	});

	$('.js-reveal-types').trigger('input');

	// Repeater
	var $repeater = $('.js-repeater');
	var repeaterTemplate = $('.js-repeater-template').html();
	var repeaterName = $repeater.data('name');

	function updateInputNames() {
		$repeater.find('li').each(function (itemNo) {
			$(this).find('[name^="' + repeaterName + '"]').each(function () {
				this.name = this.name.replace(/\[\d+\]/, '[' + itemNo + ']');
			});
		});
	}

	$('.js-repeater-add-item').on('click', () => {
		$repeater.append($(repeaterTemplate));
		updateInputNames();
	});

	$repeater.on('click', '.js-repeater-remove-item', function () {
		$(this).parents('.js-repeater-item').remove();
		updateInputNames();
	});
})();

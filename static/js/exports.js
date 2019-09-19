/* global $ */

(function () {
	var $exportTypes = $('.js-export-types');
	var $exportType = $('.js-export-type');

	$exportTypes.on('input', function () {
		var currentType = $exportTypes.val();

		$exportType.each(function () {
			var hidden = this.getAttribute('data-type') !== currentType;
			$(this).toggleClass('hidden', hidden);
			$(this).find('input, select').prop('disabled', hidden);
		});
	});
})();

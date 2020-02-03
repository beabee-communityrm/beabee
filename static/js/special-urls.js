/* global $ */

(function () {
	var $actions = $('.js-su-actions');
	var actionTemplate = $('.js-su-action-template').html();

	function updateInputNames() {
		$actions.find('li').each(function (actionNo) {
			$(this).find('[name^=actions]').each(function () {
				this.name = this.name.replace(/\[\d+\]/, '[' + actionNo + ']');
			});
		});
	}

	$('.js-su-add-action').on('click', () => {
		$actions.append($('<li>' + actionTemplate + '</li>'));
		updateInputNames();
	});

	$actions.on('click', '.js-su-remove-action', evt => {
		var container = evt.target.parentNode.parentNode;
		container.parentNode.removeChild(container);
		updateInputNames();
	});
})();

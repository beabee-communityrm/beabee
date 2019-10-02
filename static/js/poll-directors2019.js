/* global $ */

(function () {
	var $candidates = $('.js-poll-directors2019-candidate');
	var $submit = $('.js-poll-directors2019-submit');
	var $selected = $('.js-poll-directors2019-selected');

	function update() {
		var selectedCandidates = $candidates.filter(':checked').map(function () {
			return this.value;
		}).toArray();

		$submit.prop('disabled', selectedCandidates.length > 3);
		$candidates.filter(':not(:checked)').prop('disabled', selectedCandidates.length >= 3);

		var selectedHTML;
		if (selectedCandidates.length === 0) {
			selectedHTML = '<b>no candidates</b>';
		} else {
			selectedHTML = '<b>' + selectedCandidates.slice(0, -1).join('</b>, <b>') + '</b>';
			if (selectedCandidates.length > 1) {
				selectedHTML += ' and ';
			}
			selectedHTML += '<b>' + selectedCandidates.slice(-1)[0] + '</b>';
		}
		$selected.html('You have selected ' + selectedHTML + '.');
	}

	$candidates.on('change', update);
	update();
})();

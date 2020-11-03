/* global $ */

(function () {
	var $ballot = $('.js-poll-ballot');
	var $candidates = $('.js-poll-ballot-candidate');
	var $submit = $('.js-poll-ballot-submit');
	var $selected = $('.js-poll-ballot-selected');

	var minVotes = Number($ballot.data('min-votes')) || 0;
	var maxVotes = Number($ballot.data('max-votes')) || $candidates.length;

	function update() {
		var selectedCandidates = $candidates.filter(':checked').map(function () {
			return this.value;
		}).toArray();

		$submit.prop('disabled', selectedCandidates.length < minVotes || selectedCandidates.length > maxVotes);
		if (maxVotes) {
			$candidates.filter(':not(:checked)').prop('disabled', selectedCandidates.length >= maxVotes);
		}

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

/* global window, $ */

$('.js-advanced-form').on('submit', function (evt) {
	var query = $('#builder').queryBuilder('getRules');
	if (query) {
		this.elements.query.value = JSON.stringify(query);
	} else {
		evt.preventDefault();
	}
});

$('#builder').queryBuilder({
	filters: [{
		id: 'contributionMonthlyAmount',
		label: 'Contribution amount (monthly)',
		type: 'double',
	}, {
		id: 'contributionPeriod',
		label: 'Contribution period',
		type: 'string',
		input: 'select',
		values: {
			'monthly': 'Monthly',
			'annually': 'Annual',
			'gift': 'Gift'
		}
	}, {
		id: 'deliveryOptIn',
		label: 'Delivery opted-in',
		type: 'boolean',
		input: 'radio',
		values: {1: 'Yes', 0: 'No'}
	}, {
		id: 'hasActiveSubscription',
		label: 'Has active subscription',
		type: 'boolean',
		input: 'radio',
		values: {1: 'Yes', 0: 'No'}
	}, {
		id: 'dateAdded',
		label: 'Membership starts',
		type: 'datetime'
	}, {
		id: 'dateExpires',
		label: 'Membership expires',
		type: 'datetime'
	}, {
		id: 'hasTag',
		label: 'Has tag',
		type: 'string'
	}]
});

if (window.searchQuery) {
	$('#builder').queryBuilder('setRules', window.searchQuery);
}

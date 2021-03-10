/* global window, $ */

$('.js-advanced-form').on('submit', function (evt) {
	var rules = $('#builder').queryBuilder('getRules');
	if (rules) {
		this.elements.rules.value = JSON.stringify(rules);
	} else {
		evt.preventDefault();
	}
});

$('#builder').queryBuilder({
	filters: [{
		id: 'firstname',
		label: 'First name',
		type: 'string'
	},{
		id: 'lastname',
		label: 'Last name',
		type: 'string'
	},{
		id: 'email',
		label: 'Email address',
		type: 'string'
	}, {
		id: 'contributionType',
		label: 'Contribution type',
		type: 'string',
		input: 'select',
		values: ['Gift', 'GoCardless', 'Manual']
	}, {
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
			'annually': 'Annual'
		}
	}, {
		id: 'deliveryOptIn',
		label: 'Delivery opted-in',
		type: 'boolean',
		input: 'radio',
		values: {1: 'Yes', 0: 'No'}
	}, {
		id: 'activeSubscription',
		label: 'Active subscription',
		type: 'string'
	}, {
		id: 'dateAdded',
		label: 'Membership start date',
		type: 'datetime'
	}, {
		id: 'dateExpires',
		label: 'Membership expiry date',
		type: 'datetime'
	}, {
		id: 'permission',
		label: 'Permission',
		type: 'string',
		input: 'select',
		values: {
			'access': 'Access',
			'member': 'Member',
			'admin': 'Admin',
			'superadmin': 'Superadmin'
		}
	}, {
		id: 'tags',
		label: 'Has tag',
		type: 'string'
	}]
});

if (window.searchRuleGroup) {
	$('#builder').queryBuilder('setRules', window.searchRuleGroup);
}

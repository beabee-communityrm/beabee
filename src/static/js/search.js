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
		id: 'joined',
		label: 'Joined',
		type: 'datetime'
	}, {
		id: 'lastSeen',
		label: 'Last seen',
		type: 'datetime'
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
		values: {true: 'Yes', false: 'No'}
	}, {
		id: 'activeMembership',
		label: 'Has active membership',
		type: 'boolean',
		input: 'radio',
		values: {true: 'Yes', false: 'No'}
	}, {
		id: 'permission',
		label: 'Permission type',
		type: 'string',
		input: 'select',
		values: {
			'access': 'Access',
			'member': 'Member',
			'admin': 'Admin',
			'superadmin': 'Superadmin'
		}
	}, {
		id: 'dateAdded',
		label: 'Permission start date',
		type: 'datetime'
	}, {
		id: 'dateExpires',
		label: 'Permission expiry date',
		type: 'datetime'
	}, {
		id: 'tags',
		label: 'Tags',
		type: 'string'
	}]
});

if (window.searchRuleGroup) {
	$('#builder').queryBuilder('setRules', window.searchRuleGroup);
}

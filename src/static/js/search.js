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
		id: 'newsletterStatus',
		label: 'Newsletter status',
		input: 'select',
		values: {
			'subscribed': 'Subscribed',
			'unsubscribed': 'Unsubscribed'
		}
	}, {
		id: 'activeMembership',
		label: 'Is active member',
		type: 'boolean',
		input: 'radio',
		values: {true: 'Yes', false: 'No'}
	}, {
		id: 'permission',
		label: 'Role',
		type: 'string',
		input: 'select',
		values: {
			'member': 'Member',
			'admin': 'Admin',
			'superadmin': 'Superadmin'
		}
	}, {
		id: 'dateAdded',
		label: 'Role start date',
		type: 'datetime'
	}, {
		id: 'dateExpires',
		label: 'Role expiry date',
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

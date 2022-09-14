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
		values: ['Gift', 'Automatic', 'Manual', 'None'],
		operators: ['equal', 'not_equal']
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
		},
		operators: ['equal', 'not_equal']
	}, {
		id: 'deliveryOptIn',
		label: 'Delivery opted-in',
		type: 'boolean',
		input: 'radio',
		values: {true: 'Yes', false: 'No'},
		operators: ['equal']
	}, {
		id: 'newsletterStatus',
		label: 'Newsletter status',
		input: 'select',
		values: {
			'subscribed': 'Subscribed',
			'unsubscribed': 'Unsubscribed',
			'cleaned': 'Cleaned',
			'pending': 'Pending',
			'none': 'None'
		},
		operators: ['equal', 'not_equal']
	}, {
		id: 'activeMembership',
		label: 'Is active member',
		type: 'boolean',
		input: 'radio',
		values: {true: 'Yes', false: 'No'},
		operators: ['equal']
	}, {
		id: 'membershipExpires',
		label: 'Membership expires',
		type: 'datetime'
	}, {
		id: 'activePermission',
		label: 'Role',
		type: 'string',
		input: 'select',
		values: {
			'member': 'Member',
			'admin': 'Admin',
			'superadmin': 'Superadmin'
		}
	}, {
		id: 'tags',
		label: 'Tags',
		type: 'string',
		operators: ['contains']
	}, {
		id: 'manualPaymentSource',
		label: 'Manual payment source',
		type: 'string'
	}]
});

if (window.searchRuleGroup) {
	$('#builder').queryBuilder('setRules', window.searchRuleGroup);
}

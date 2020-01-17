module.exports = [
	{
		name: 'Log in',
		getParams: async () => [ {
			name: 'confirmEmail',
			label: 'Confirm email?',
			type: 'boolean'
		} ],
		getUrlParams: member => ( { memberId: member._id } ),
		run: async ( req, params ) => true
	},
	{
		name: 'Change contribution',
		getParams: async () => [{
			name: 'amount',
			label: 'Amount',
			type: 'number'
		}],
		getUrlParams: () => ({}),
		run: async ( req, params ) => true
	},
	{
		name: 'Absorb fee',
		getUrlParams: () => ({}),
		run: async ( req, params ) => true
	}
];

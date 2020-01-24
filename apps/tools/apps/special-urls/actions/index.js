const { Members } = require( __js + '/database' );

const { canChangeSubscription, processUpdateSubscription } = require( __apps + '/profile/apps/direct-debit/utils' );

module.exports = [
	{
		name: 'Log in',
		getParams: async () => [ {
			name: 'confirmEmail',
			label: 'Confirm email?',
			type: 'boolean'
		} ],
		getUrlParams: member => ( { memberId: member._id } ),
		run: async ( req, res, { memberId, confirmEmail } ) => {
			const member = await Members.findById( memberId );

			if ( confirmEmail ) {
				// TODO
				res.render( 'actions/confirm-email.pug' );
				return false;
			} else {
				return await new Promise( resolve => {
					req.login( member, () => resolve(true) );
				} );
			}
		}
	},
	{
		name: 'Change contribution',
		getParams: async () => [{
			name: 'amount',
			label: 'Amount',
			type: 'number'
		}],
		getUrlParams: () => ({}),
		run: async ( req, res, { amount } ) => {
			if ( !req.user ) {
				res.redirect( '/login?next=' + req.originalUrl );
				return false;
			}

			if ( await canChangeSubscription( req.user ) ) {
				await processUpdateSubscription( req.user, {
					amount: req.user.contributionMonthlyAmount + Number(amount)
				} );
			}

			return true;
		}
	},
	{
		name: 'Absorb fee',
		getUrlParams: () => ({}),
		run: async ( req, res, params ) => true
	}
];

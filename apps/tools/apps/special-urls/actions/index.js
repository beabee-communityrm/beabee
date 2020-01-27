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
					req.login( member, () => {
						// Force session to be temporary
						req.session.cookie.expires = false;
						resolve(true);
					} );
				} );
			}
		}
	},
	{
		name: 'Log out',
		run: async ( req ) => {
			if ( req.user ) {
				req.logout();
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
					amount: req.user.contributionMonthlyAmount + amount
				} );
			}

			return true;
		}
	},
	{
		name: 'Absorb fee',
		getUrlParams: () => ({}),
		run: async ( req, res ) => {
			if ( !req.user ) {
				res.redirect( '/login?next=' + req.originalUrl );
				return false;
			}

			if ( await canChangeSubscription( req.user ) ) {
				await processUpdateSubscription( req.user, {
					amount: req.user.contributionMonthlyAmount,
					payFee: true
				} );
			}

			return true;
		}
	}
];

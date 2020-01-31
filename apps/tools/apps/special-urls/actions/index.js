const { Members } = require( __js + '/database' );

const { canChangeSubscription, processUpdateSubscription } = require( __apps + '/profile/apps/direct-debit/utils' );

module.exports = [
	{
		name: 'Log in',
		getParams: async () => [ /*{
			name: 'confirmEmail',
			label: 'Confirm email?',
			type: 'boolean'
		}*/ ],
		getUrlParams: member => ( { memberId: member._id } ),
		run: async ( req, res, { memberId } ) => {
			const member = await Members.findById( memberId );

			await new Promise( resolve => {
				req.login( member, () => {
					// Force session to be temporary
					req.session.cookie.expires = false;
					resolve();
				} );
			} );

			return true;
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
		}, {
			name: 'isAbsolute',
			label: 'Absolute change?',
			type: 'boolean'
		}],
		run: async ( req, res, { amount, isAbsolute } ) => {
			if ( !req.user ) {
				res.redirect( '/login?next=' + req.originalUrl );
				return false;
			}

			if ( req.user.hasActiveSubscription && await canChangeSubscription( req.user ) ) {
				await processUpdateSubscription( req.user, {
					amount: isAbsolute ? amount : req.user.contributionMonthlyAmount + amount
				} );
			} else {
				res.render( 'change-contribution/cant-change' );
				return false;
			}

			return true;
		}
	},
	{
		name: 'Absorb fee',
		run: async ( req, res ) => {
			if ( !req.user ) {
				res.redirect( '/login?next=' + req.originalUrl );
				return false;
			}

			if ( req.user.hasActiveSubscription && await canChangeSubscription( req.user ) ) {
				await processUpdateSubscription( req.user, {
					amount: req.user.contributionMonthlyAmount,
					payFee: true
				} );
			} else {
				res.render( 'change-contribution/cant-change' );
				return false;
			}

			return true;
		}
	},
	{
		name: 'Set tag',
		getParams: async () => [ {
			name: 'tagName',
			label: 'Tag',
			type: 'string'
		} ],
		run: async ( req, res, { tagName } ) => {
			if ( !req.user ) {
				res.redirect( '/login?next=' + req.originalUrl );
				return false;
			}

			await req.user.update( { $push: { tags: { name: tagName } } } );
			return true;
		}
	}
];

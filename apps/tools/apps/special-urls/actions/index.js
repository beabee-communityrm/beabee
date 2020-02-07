const { Members } = require( __js + '/database' );

const { canChangeSubscription, processUpdateSubscription } = require( __apps + '/profile/apps/direct-debit/utils' );

module.exports = [
	{
		name: 'Log in',
		run: async ( req ) => {
			const member = await Members.findOne( { email: req.specialUrl.email } ).populate( 'permissions.permission' );

			if (!member) {
				throw Error('Unknown member');
			}

			await new Promise( resolve => {
				req.login( member, () => {
					// Force session to be temporary
					req.session.cookie.expires = false;

					// TODO: remove this, currently copied from auth deserializeUser
					let permissions = [];
					// Loop through permissions check they are active right now and add those to the array
					for ( var p = 0; p < member.permissions.length; p++ ) {
						if ( member.permissions[p].date_added <= new Date() ) {
							if ( ! member.permissions[p].date_expires || member.permissions[p].date_expires > new Date() ) {
								permissions.push( member.permissions[p].permission.slug );
							}
						}
					}

					req.user.quickPermissions = permissions;

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
			return true;
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

			if ( req.user.hasActiveSubscription && await canChangeSubscription( req.user, true ) ) {
				await processUpdateSubscription( req.user, {
					amount: isAbsolute ? amount : req.user.contributionMonthlyAmount + amount
				} );
			} else {
				res.render( 'actions/cant-change-contribution' );
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

			if ( req.user.hasActiveSubscription && await canChangeSubscription( req.user, true ) ) {
				await processUpdateSubscription( req.user, {
					amount: req.user.contributionMonthlyAmount,
					payFee: true
				} );
			} else {
				res.render( 'actions/cant-change-contribution' );
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

const express = require('express');

const auth = require( __js + '/authentication' );
const gocardless = require( __js + '/gocardless' );
const mandrill = require( __js + '/mandrill' );
const{ hasSchema } = require( __js + '/middleware' );
const { getActualAmount, getSubscriptionName, wrapAsync } = require( __js + '/utils' );

const { cancelSubscriptionSchema, updateSubscriptionSchema } = require('./schemas.json');
const { calcSubscriptionMonthsLeft, canChangeSubscription } = require('./utils');

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.parent.mountpath + app.mountpath
	} );
	res.locals.activeApp = 'profile';
	next();
} );

app.get( '/', auth.isLoggedIn,  function ( req, res ) {
	if ( req.user.hasActiveSubscription ) {
		res.render( 'active', {
			user: req.user,
			canChange: canChangeSubscription(req.user),
			monthsLeft: calcSubscriptionMonthsLeft(req.user)
		} );
	} else {
		res.render( 'inactive', { user: req.user } );
	}
} );

function isLoggedInWithSubscription( req, res, next ) {
	auth.isLoggedIn(req, res, () => {
		if ( req.user.hasActiveSubscription ) {
			next();
		} else {
			req.flash( 'danger', 'contribution-doesnt-exist' );
			res.redirect( app.parent.mountpath + app.mountpath );
		}
	});
}

app.get( '/cancel-subscription', isLoggedInWithSubscription, ( req, res ) => {
	res.render( 'cancel-subscription' );
} );

app.post( '/cancel-subscription', [
	isLoggedInWithSubscription,
	hasSchema(cancelSubscriptionSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const { user, body: { satisfied, reason, other } } = req;

	try {
		await user.update( { $set: {
			'cancellation': { satisfied, reason, other }
		} } );

		await gocardless.subscriptions.cancel( user.gocardless.subscription_id );

		await user.update( { $unset: {
			'gocardless.subscription_id': true,
		}, $set: {
			'gocardless.cancelled_at': new Date()
		} } );

		await mandrill.sendToMember('cancelled-contribution-no-survey', user);

		req.flash( 'success', 'contribution-cancelled' );
	} catch ( error ) {
		req.log.error( {
			app: 'direct-debit',
			action: 'cancel-subscription',
			error
		});

		req.flash( 'danger', 'contribution-cancellation-err' );
	}

	res.redirect( app.parent.mountpath + app.mountpath );
} ) );

async function updateSubscriptionAmount(user, newAmount) {
	const actualAmount = getActualAmount(newAmount, user.contributionPeriod);

	try {
		await gocardless.subscriptions.update( user.gocardless.subscription_id, {
			amount: actualAmount * 100,
			name: getSubscriptionName( actualAmount, user.contributionPeriod )
		} );
	} catch ( gcError ) {
		// Can't update subscription names if they are linked to a plan
		if ( gcError.response && gcError.response.status === 422 ) {
			await gocardless.subscriptions.update( user.gocardless.subscription_id, {
				amount: actualAmount * 100
			} );
		} else {
			throw gcError;
		}
	}
}

async function activateSubscription(user, newAmount, prorate) {
	const subscriptionMonthsLeft = calcSubscriptionMonthsLeft(user);

	if (subscriptionMonthsLeft > 0) {
		if (prorate && newAmount > user.contributionMonthlyAmount) {
			await gocardless.payments.create({
				amount: (newAmount - user.contributionMonthlyAmount) * subscriptionMonthsLeft * 100,
				currency: 'GBP',
				description: 'One-off payment to start new contribution',
				links: {
					mandate: user.gocardless.mandate_id
				}
			});
			return true;
		} else {
			return false;
		}
	} else {
		return true;
	}
}

app.post( '/update-subscription', [
	isLoggedInWithSubscription,
	hasSchema(updateSubscriptionSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const { body:  { amount, prorate }, user } = req;

	if (!canChangeSubscription(user)) {
		req.flash('warning', 'contribution-updating-not-allowed');
	} else if (amount === user.contributionMonthlyAmount) {
		req.flash('warning', 'contribution-updating-same');
	} else {
		try {
			await updateSubscriptionAmount(user, amount);

			req.log.debug( {
				app: 'direct-debit',
				action: 'update-subscription',
				senstive: {
					user: user._id,
					amount,
					oldAmount: user.contributionMonthlyAmount,
				}
			} );

			if (await activateSubscription(user, amount, prorate)) {
				req.log.debug( {
					app: 'direct-debit',
					action: 'active-subscription-now',
				} );
				await user.update( {
					$set: { 'gocardless.amount': amount },
					$unset: { 'gocardless.next_amount': true }
				} );
			} else {
				req.log.debug( {
					app: 'direct-debit',
					action: 'activate-subscription-later',
				} );
				await user.update( {
					$set: { 'gocardless.next_amount': amount }
				} );
			}

			req.flash( 'success', 'contribution-updated' );
		} catch ( error ) {
			req.log.error( {
				app: 'direct-debit',
				action: 'update-subscription',
				error
			});

			req.flash( 'danger', 'contribution-updating-err' );
		}
	}

	res.redirect( app.parent.mountpath + app.mountpath );
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};

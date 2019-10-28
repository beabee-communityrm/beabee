const express = require('express');
const moment = require('moment');

const auth = require( __js + '/authentication' );
const gocardless = require( __js + '/gocardless' );
const mandrill = require( __js + '/mandrill' );
const{ hasSchema } = require( __js + '/middleware' );
const { getActualAmount, getSubscriptionName, wrapAsync } = require( __js + '/utils' );

const config = require( __config );

const { createJoinFlow, completeJoinFlow, startMembership, joinInfoToSubscription } = require( __apps + '/join/utils' );

const { cancelSubscriptionSchema, completeFlowSchema, updateSubscriptionSchema } = require('./schemas.json');
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

app.use( auth.isLoggedIn );

async function getBankAccount(mandateId) {
	const mandate = await gocardless.mandates.get(mandateId);
	return await gocardless.customerBankAccounts.get(mandate.links.customer_bank_account);
}

app.get( '/', wrapAsync( async function ( req, res ) {
	const bankAccount = req.user.gocardless.mandate_id ?
		await getBankAccount(req.user.gocardless.mandate_id) : null;

	res.render( 'index', {
		user: req.user,
		bankAccount,
		canChange: canChangeSubscription(req.user),
		monthsLeft: calcSubscriptionMonthsLeft(req.user)
	} );
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

async function processUpdateSubscription(user, { amount, period, prorate }) {
	if (user.isActiveMember) {
		if (user.hasActiveSubscription) {
			if (amount !== user.contributionMonthlyAmount) {
				await updateSubscriptionAmount(user, amount);
			}
		} else {
			const subscription = await gocardless.subscriptions.create({
				...joinInfoToSubscription(amount, period, user.gocardless.mandate_id),
				start_date: moment(user.memberPermission.date_expires).subtract(config.gracePeriod).format('YYYY-MM-DD')
			});

			user.gocardless.subscription_id = subscription.id;
			user.gocardless.period = period;
		}

		if (await activateSubscription(user, amount, prorate)) {
			user.amount = amount;
			user.next_amount = undefined;
		} else {
			user.next_amount = amount;
		}

		await user.save();
	} else {
		// TODO: handle this
		if (user.hasActiveSubscription) {
			throw new Error('Can\'t update active subscriptions for expired members');
		} else {
			await startMembership(user, {amount, period});
		}
	}
}

app.post( '/', [
	hasSchema(updateSubscriptionSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const { body:  { useMandate, ...updateForm }, user } = req;

	if ( canChangeSubscription( user ) ) {
		if ( useMandate && user.canTakePayment ) {
			await processUpdateSubscription( user, updateForm );
			req.flash( 'success', 'gocardless-subscription-updated' );
			res.redirect( app.parent.mountpath + app.mountpath );
		} else {
			const completeUrl = config.audience + '/profile/direct-debit/complete';
			const redirectUrl = await createJoinFlow( completeUrl, updateForm );
			res.redirect( redirectUrl );
		}
	} else {
		req.flash( 'warning', 'contribution-updating-not-allowed' );
	}
} ) );

app.get( '/complete', [
	hasSchema( completeFlowSchema ).orRedirect('/profile')
], wrapAsync( async (req, res) => {
	const { user } = req;

	const { customerId, mandateId, joinForm } = await completeJoinFlow( req.query.redirect_flow_id );

	if ( user.gocardless.mandate_id ) {
		// Remove subscription before cancelling mandate to stop the
		// webhook triggering a cancelled email
		await user.update({$unset: {'gocardless.subscription_id': 1}});
		await gocardless.mandates.cancel(user.gocardless.mandate_id);
	}

	user.gocardless.customer_id = customerId;
	user.gocardless.mandate_id = mandateId;
	user.gocardless.subscription_id = undefined;
	await user.save();

	await processUpdateSubscription(user, joinForm);
	req.flash( 'success', 'gocardless-subscription-updated');
	res.redirect('/profile');
} ) );

function hasSubscription( req, res, next ) {
	if ( req.user.hasActiveSubscription ) {
		next();
	} else {
		req.flash( 'danger', 'contribution-doesnt-exist' );
		res.redirect( app.parent.mountpath + app.mountpath );
	}
}

app.get( '/cancel-subscription', hasSubscription, ( req, res ) => {
	res.render( 'cancel-subscription' );
} );

app.post( '/cancel-subscription', [
	hasSubscription,
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

module.exports = function( config ) {
	app_config = config;
	return app;
};

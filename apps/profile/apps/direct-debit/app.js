const express = require('express');
const moment = require('moment');

const auth = require( '@core/authentication' );
const { Payments } = require( '@core/database' );
const { default: gocardless } = require( '@core/gocardless' );
const mandrill = require( '@core/mandrill' );
const{ hasSchema } = require( '@core/middleware' );
const { wrapAsync } = require( '@core/utils' );

const config = require( '@config' );

const { default: JoinFlowService } = require( '@core/services/JoinFlowService' );

const { cancelSubscriptionSchema, completeFlowSchema, updateSubscriptionSchema } = require('./schemas.json');
const { calcSubscriptionMonthsLeft, canChangeSubscription, getBankAccount, handleUpdateSubscription } = require('./utils');

const app = express();
var app_config = {};

function hasSubscription( req, res, next ) {
	if ( req.user.hasActiveSubscription ) {
		next();
	} else {
		req.flash( 'danger', 'contribution-doesnt-exist' );
		res.redirect( app.parent.mountpath + app.mountpath );
	}
}

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.parent.mountpath + app.mountpath
	} );
	next();
} );

app.use( auth.isLoggedIn );

app.get( '/', wrapAsync( async function ( req, res ) {
	let isFirstPayment = false;
	if (req.user.contributionPeriod !== 'gift') {
		// Limit to 2 because if there are 2+ payments it's not their first payment
		const payments = await Payments.find( { member: req.user }, { limit: 2 } );
		isFirstPayment = payments.length === 1 && payments[0].isPending;
	}

	res.render( 'index', {
		user: req.user,
		isFirstPayment,
		bankAccount: await getBankAccount(req.user),
		canChange: await canChangeSubscription(req.user, req.user.canTakePayment),
		monthsLeft: calcSubscriptionMonthsLeft(req.user)
	} );
} ) );

app.post( '/', [
	hasSchema(updateSubscriptionSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const { body:  { useMandate, ...updateForm }, user } = req;

	if ( await canChangeSubscription( user, useMandate ) ) {
		req.log.info( {
			app: 'direct-debit',
			action: 'update-subscription',
			data: {
				useMandate,
				updateForm
			}
		} );
		if ( useMandate ) {
			await handleUpdateSubscription(req, user, updateForm);
			res.redirect( app.parent.mountpath + app.mountpath );
		} else {
			const completeUrl = config.audience + '/profile/direct-debit/complete';
			const redirectUrl = await JoinFlowService.createJoinFlow( completeUrl, updateForm, {
				prefilled_customer: {
					email: user.email,
					given_name: user.firstname,
					family_name: user.lastname
				}
			} );
			res.redirect( redirectUrl );
		}
	} else {
		req.flash( 'warning', 'contribution-updating-not-allowed' );
		res.redirect( app.parent.mountpath + app.mountpath );
	}
} ) );

app.get( '/complete', [
	hasSchema( completeFlowSchema ).orRedirect('/profile')
], wrapAsync( async (req, res) => {
	const { user } = req;

	if (await canChangeSubscription(user, false)) {
		const { customer, mandateId, joinForm } = await JoinFlowService.completeJoinFlow( req.query.redirect_flow_id );

		if ( user.gocardless.mandate_id ) {
			// Remove subscription before cancelling mandate to stop the
			// webhook triggering a cancelled email
			await user.update({$unset: {'gocardless.subscription_id': 1}});
			await gocardless.mandates.cancel(user.gocardless.mandate_id);
		}

		// The new mandates first possible charge date could be after the
		// membership expiry date, if so increase the expiry date
		const mandate = await gocardless.mandates.get(mandateId);
		const nextChargeDate = moment.utc(mandate.next_possible_charge_date).add(config.gracePeriod);
		if (nextChargeDate.isAfter(user.memberPermission.expires)) {
			user.memberPermission.date_expires = nextChargeDate;
		}

		user.gocardless.customer_id = customer.id;
		user.gocardless.mandate_id = mandateId;
		user.gocardless.subscription_id = undefined;
		await user.save();

		await handleUpdateSubscription(req, user, joinForm);
	} else {
		req.flash( 'warning', 'contribution-updating-not-allowed' );
	}

	res.redirect( app.parent.mountpath + app.mountpath );
} ) );

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

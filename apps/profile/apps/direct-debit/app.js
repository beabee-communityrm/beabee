const express = require('express');

const auth = require( __js + '/authentication' );
const gocardless = require( __js + '/gocardless' );
const mandrill = require( __js + '/mandrill' );
const{ hasSchema } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const config = require( __config );

const { createJoinFlow, completeJoinFlow } = require( __apps + '/join/utils' );

const { cancelSubscriptionSchema, completeFlowSchema, updateSubscriptionSchema } = require('./schemas.json');
const { calcSubscriptionMonthsLeft, canChangeSubscription, getBankAccount, processUpdateSubscription } = require('./utils');

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
	res.locals.activeApp = 'profile';
	next();
} );

app.use( auth.isLoggedIn );

app.get( '/', wrapAsync( async function ( req, res ) {
	res.render( 'index', {
		user: req.user,
		bankAccount: await getBankAccount(req.user),
		canChange: canChangeSubscription(req.user),
		monthsLeft: calcSubscriptionMonthsLeft(req.user)
	} );
} ) );

app.post( '/', [
	hasSchema(updateSubscriptionSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const { body:  { useMandate, ...updateForm }, user } = req;

	if ( canChangeSubscription( user ) ) {
		req.log.info( {
			app: 'direct-debit',
			action: 'update-subscription',
			data: {
				useMandate,
				updateForm
			}
		} );
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

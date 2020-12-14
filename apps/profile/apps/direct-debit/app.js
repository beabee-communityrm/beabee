const express = require('express');

const auth = require( '@core/authentication' );
const { Payments } = require( '@core/database' );
const mandrill = require( '@core/mandrill' );
const{ hasSchema } = require( '@core/middleware' );
const { wrapAsync } = require( '@core/utils' );

const config = require( '@config' );

const { default: JoinFlowService } = require( '@core/services/JoinFlowService' );
const { default: PaymentService } = require( '@core/services/PaymentService' );

const { cancelSubscriptionSchema, completeFlowSchema, updateSubscriptionSchema } = require('./schemas.json');

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
		bankAccount: await PaymentService.getBankAccount(req.user),
		canChange: await PaymentService.canChangeContribution(req.user, req.user.canTakePayment),
		monthsLeft: PaymentService.getMonthsLeftOnContribution(req.user)
	} );
} ) );

function schemaToPaymentForm(data) {
	return {
		amount: data.amount,
		period: data.period,
		payFee: !!data.payFee,
		prorate: data.prorate
	};
}

async function handleChangeContribution(req, user, form) {
	const wasGift = user.contributionPeriod === 'gift';
	await PaymentService.updateContribution(user, form);
	if (wasGift) {
		await mandrill.sendToMember('welcome-post-gift', user);
		req.flash( 'success', 'contribution-gift-updated' );
	} else {
		req.flash( 'success', 'contribution-updated' );
	}
}

app.post( '/', [
	hasSchema(updateSubscriptionSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const { body:  { useMandate }, user } = req;
	const paymentForm = schemaToPaymentForm(req.body);

	if ( await PaymentService.canChangeContribution( user, useMandate ) ) {
		req.log.info( {
			app: 'direct-debit',
			action: 'update-subscription',
			data: {
				useMandate,
				paymentForm
			}
		} );
		if ( useMandate ) {
			await handleChangeContribution(req, user, paymentForm);
			res.redirect( app.parent.mountpath + app.mountpath );
		} else {
			const completeUrl = config.audience + '/profile/direct-debit/complete';
			const redirectUrl = await JoinFlowService.createJoinFlow( completeUrl, paymentForm, {
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

	if (await PaymentService.canChangeContribution(user, false)) {
		const { customer, mandateId, joinForm } = await JoinFlowService.completeJoinFlow( req.query.redirect_flow_id );
		await PaymentService.updatePaymentMethod(user, customer.id, mandateId);
		await handleChangeContribution(req, user, joinForm);
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

		await PaymentService.cancelContribution( user );

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

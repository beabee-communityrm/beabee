global.__root = __dirname;
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

const config = require( __config );

const moment = require('moment');
const express = require('express');
const bodyParser = require('body-parser');

const log = require( __js + '/logging' ).log;
const { Members, Payments } = require( __js + '/database' ).connect( config.mongo );
const gocardless = require( __js + '/gocardless' );
const mandrill = require( __js + '/mandrill' );

const utils = require('./webhook-utils');

const app = express();
const textBodyParser = bodyParser.text( {
	type: 'application/json',
	limit: '1mb'
} );

// Add logging capabilities
require( __js + '/logging' ).installMiddleware( app );

app.get( '/ping', function( req, res ) {
	req.log.info( {
		app: 'webhook',
		action: 'ping'
	} );
	res.sendStatus( 200 );
} );

app.post( '/', textBodyParser, async function( req, res ) {
	const valid = gocardless.webhooks.validate( req );

	if ( valid ) {
		var events = JSON.parse( req.body ).events;

		try {
			for ( var e in events ) {
				await handleResourceEvent( events[e] );
			}

			res.sendStatus( 200 );
		} catch ( error ) {
			console.log( error );
			req.log.error( {
				app: 'webhook',
				action: 'main',
				error
			} );
			res.status( 500 ).send( error );
		}
	} else {
		req.log.info( {
			app: 'webhook',
			action: 'main',
			error: 'invalid webhook signature'
		} );
		res.sendStatus( 498 );
	}
} );

// Start server
log.info( {
	app: 'webhook',
	action: 'start'
} );

const listener = app.listen( config.gocardless.port, config.host, function () {
	log.debug( {
		app: 'webhook',
		action: 'start-webserver',
		message: 'Started',
		address: listener.address()
	} );
} );

async function handleResourceEvent( event ) {
	switch( event.resource_type ) {
	case 'payments':
		return await handlePaymentResourceEvent( event );
	case 'subscriptions':
		return await handleSubscriptionResourceEvent( event );
	case 'mandates':
		return await handleMandateResourceEvent( event );
	case 'refunds':
		return await handleRefundResourceEvent( event );
	default:
		log.debug( {
			app: 'webhook',
			action: 'unhandled-resource-event',
			event: event
		} );
		break;
	}
}

async function handlePaymentResourceEvent( event ) {
	const gcPayment = await gocardless.payments.get( event.links.payment );
	const payment =
		await Payments.findOne( { payment_id: gcPayment.id } ) ||
		await createPayment( gcPayment );

	switch( event.action ) {
	case 'confirmed': // Collected
		await confirmPayment( payment );
	case 'created': // Pending
	case 'submitted': // Processing
	case 'cancelled': // Cancelled
	case 'failed': // Failed
	case 'paid_out': // Received
		await updatePayment( gcPayment, payment );
		break;
	}
}

async function createPayment( gcPayment ) {
	const member = await Members.findOne( { 'gocardless.mandate_id': gcPayment.links.mandate } );
	const payment = utils.createPayment( gcPayment );

	if ( member ) {
		log.info( {
			app: 'webhook',
			action: 'create-payment',
			payment: payment,
			member: member._id
		} );
	} else {
		log.warn( {
			app: 'webhook',
			action: 'create-unlinked-payment',
			payment: payment
		} );
	}

	const subscription = gcPayment.links.subscription &&
		await gocardless.subscriptions.get(gcPayment.links.subscription);

	return await Payments.create({
		...payment,
		...member && {member: member._id},
		...subscription && {
			subscription_period: utils.getSubscriptionPeriod(subscription)
		}
	});

}

async function updatePayment( gcPayment, payment ) {
	await payment.update( { $set: utils.createPayment(gcPayment) } );

	log.info( {
		app: 'webhook',
		action: 'update-payment',
		payment: payment
	} );
}

async function confirmPayment( payment ) {
	if ( payment.member && payment.subscription_id ) {
		const subscription = await gocardless.subscriptions.get(payment.subscription_id);
		const expiryDate = subscription.upcoming_payments.length > 0 ?
			moment.utc(subscription.upcoming_payments[0].charge_date) :
			moment.utc(payment.charge_date).add(utils.getSubscriptionDuration(subscription));

		const member = await Members.findOne( { _id: payment.member } );
		if (member.memberPermission) {
			if (member.gocardless.next_amount) {
				member.gocardless.amount = member.gocardless.next_amount;
				member.gocardless.next_amount = undefined;
			}
			member.memberPermission.date_expires = expiryDate.add(config.gracePeriod).toDate();
			await member.save();

			log.info( {
				app: 'webhook',
				action: 'extend-membership',
				until: member.memberPermission.date_expires,
				sensitive: {
					member: member._id
				}
			} );
		} else {
			log.error( {
				app: 'webhook',
				action: 'extend-membership',
				date: expiryDate,
				error: 'Membership not found',
				sensitive: {
					member: member._id
				}
			} );
		}
	}
}

// Subscription events

async function handleSubscriptionResourceEvent( event ) {
	switch( event.action ) {
	case 'created':
	case 'customer_approval_granted':
	case 'payment_created':
	case 'amended':
		// Do nothing, we already have the details on file.
		break;
	case 'customer_approval_denied':
	case 'cancelled':
	case 'finished':
		// Remove the subscription from the database
		await cancelledSubscription( event );
		break;
	}
}

async function cancelledSubscription( event ) {
	const member = await Members.findOne( {
		'gocardless.subscription_id': event.links.subscription,
		// Ignore users that cancelled online, we've already handled them
		'cancellation.satisified': { $exists: false }
	} );

	if ( member ) {
		await member.update( { $unset: {
			'gocardless.subscription_id': true,
		}, $set: {
			'gocardless.cancelled_at': new Date()
		} } );

		await mandrill.sendToMember('cancelled-contribution', member);

		log.info( {
			app: 'webhook',
			action: 'remove-subscription-id',
			sensitive: {
				member: member._id,
				subscription_id: event.links.subscription
			}
		} );
	} else {
		log.info( {
			app: 'webhook',
			action: 'unlink-subscription',
			sensitive: {
				subscription_id: event.links.subscription
			}
		} );
	}
}

async function handleMandateResourceEvent( event ) {
	switch( event.action ) {
	case 'created':
	case 'customer_approval_granted':
	case 'customer_approval_skipped':
	case 'submitted':
	case 'active':
	case 'transferred':
		// Do nothing, we already have the details on file.
		break;
	case 'reinstated':
		log.info( {
			app: 'webhook',
			action: 'reinstate-mandate',
			message: 'Mandate reinstated, its likely this mandate wont be linked to a member...',
			sensitive: {
				event: event
			}
		} );
		break;
	case 'cancelled':
	case 'failed':
	case 'expired':
		// Remove the mandate from the database
		await cancelledMandate( event );
		break;
	}
}

async function cancelledMandate( event ) {
	const member = await Members.findOne( { 'gocardless.mandate_id': event.links.mandate } );

	if ( member ) {
		await member.update( { $unset: {
			'gocardless.mandate_id': true
		} } );

		log.info( {
			app: 'webhook',
			action: 'remove-mandate-id',
			sensitive: {
				member: member._id,
				mandate_id: event.links.mandate
			}
		} );
	} else {
		log.info( {
			app: 'webhook',
			action: 'unlink-mandate',
			sensitive: {
				mandate_id: event.links.mandate
			}
		} );
	}
}

async function handleRefundResourceEvent( event ) {
	const refund = await gocardless.refunds.get( event.links.refund );

	const gcPayment = await gocardless.payments.get( refund.links.payment );
	const payment = await Payments.findOne( { payment_id: gcPayment.id } );

	if ( payment ) {
		await updatePayment( gcPayment, payment );

		log.info( {
			app: 'webhook',
			action: 'process-refund',
			sensitive: {
				refund_id: refund.id,
				payment_id: gcPayment.id
			}
		} );
	}
}

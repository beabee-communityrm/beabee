import 'module-alias/register';

import bodyParser from 'body-parser';
import express from 'express';
import { Event, EventResourceType } from 'gocardless-nodejs/types/Types';
import { ConnectionOptions } from 'typeorm';

import { installMiddleware, log } from '@core/logging';
import * as db from '@core/database';
import gocardless from '@core/gocardless';
import { wrapAsync } from '@core/utils';

import GCPaymentWebhookService from '@core/services/GCPaymentWebhookService';
import OptionsService from '@core/services/OptionsService';

import config from '@config';

const app = express();
const textBodyParser = bodyParser.text( {
	type: 'application/json',
	limit: '1mb'
} );

// Add logging capabilities
installMiddleware( app );

app.get( '/ping', function( req, res ) {
	log.info( {
		action: 'ping'
	} );
	res.sendStatus( 200 );
} );

app.post( '/', textBodyParser, wrapAsync(async (req, res) => {
	const valid = gocardless.webhooks.validate( req );

	if ( valid ) {
		const events = JSON.parse( req.body ).events as Event[];

		log.info({
			action: 'got-events',
		}, `Got ${events.length} events`);

		try {
			for ( const event of events ) {
				log.info({
					action: 'handle-event',
				}, `Got ${event.action} on ${event.resource_type}: ${JSON.stringify(event.links)}`);

				await handleEventResource( event );
			}

			res.sendStatus( 200 );
		} catch ( error ) {
			log.error( {
				action: 'got-events-error',
				error
			} );
			res.status( 500 ).send( error );
		}
	} else {
		log.error( {
			action: 'invalid-webhook-signature'
		}, 'Invalid webhook signature' );
		res.sendStatus( 498 );
	}
} ) );

const internalApp = express();

internalApp.post('/reload', wrapAsync(async (req, res) => {
	await OptionsService.reload();
	res.sendStatus(200);
}));

// Start server
log.info( {
	action: 'start'
} );

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	await OptionsService.reload();

	app.listen( config.gocardless.port, config.host, function () {
		log.debug( {action: 'start-webserver'} );
	} );

	internalApp.listen(config.gocardless.internalPort, config.host, () => {
		log.debug( {action: 'internal-webserver-started'} );
	});
});

async function handleEventResource( event: Event ) {
	switch( event.resource_type ) {
	case EventResourceType.Payments:
		return await handlePaymentResourceEvent( event );
	case EventResourceType.Subscriptions:
		return await handleSubscriptionResourceEvent( event );
	case EventResourceType.Mandates:
		return await handleMandateResourceEvent( event );
	case EventResourceType.Refunds:
		return await handleRefundResourceEvent( event );
	default:
		log.debug( {
			action: 'unhandled-event',
			event
		} );
		break;
	}
}

async function handlePaymentResourceEvent( event: Event ) {
	// GC sends a paid_out action per payment when a payout is processed, which
	// means 1,000s of events.  In the docs they say you should always fetch the
	// related payment to check it hasn't changed, but if we do that we get rate
	// limited. It seems like we can pretty safely assume paid out payments
	// haven't changed though.
	if ( event.action === 'paid_out' ) {
		await GCPaymentWebhookService.updatePaymentStatus(event.links.payment, 'paid_out');
	} else {
		const payment = await GCPaymentWebhookService.updatePayment(event.links.payment);
		if (event.action === 'confirmed') {
			await GCPaymentWebhookService.confirmPayment(payment);
		}
	}
}

async function handleSubscriptionResourceEvent( event: Event ) {
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
		await GCPaymentWebhookService.cancelSubscription(event.links.subscription);
		break;
	}
}

async function handleMandateResourceEvent( event: Event ) {
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
		log.error( {
			action: 'reinstate-mandate',
			sensitive: {
				event: event
			}
		}, 'Mandate reinstated, its like this mandate won\'t be linked to a member...' );
		break;
	case 'cancelled':
	case 'failed':
	case 'expired':
		// Remove the mandate from the database
		await GCPaymentWebhookService.cancelMandate(event.links.mandate);
		break;
	}
}

async function handleRefundResourceEvent( event: Event ) {
	const refund = await gocardless.refunds.get( event.links.refund );
	await GCPaymentWebhookService.updatePayment(refund.links.payment);
}

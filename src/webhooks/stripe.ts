import 'module-alias/register';

import bodyParser from 'body-parser';
import express from 'express';
import Stripe from 'stripe';
import { ConnectionOptions } from 'typeorm';

import * as db from '@core/database';
import { log, installMiddleware } from '@core/logging';
import stripe from '@core/stripe';
import { wrapAsync } from '@core/utils';

import GiftService from '@core/services/GiftService';

import config from '@config';

const app = express();

installMiddleware(app);
app.use(bodyParser.raw({type: 'application/json'}));

app.get( '/ping', (req, res) => {
	req.log.info( {
		app: 'webhook-stripe',
		action: 'ping'
	} );
	res.sendStatus( 200 );
} );

app.post( '/', wrapAsync(async (req, res) => {
	const sig = req.headers['stripe-signature'] as string;

	try {
		const evt = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhook_secret);

		log.info({
			app: 'webhook-stripe',
			action: 'got-webhook',
			type: evt.type
		});

		if (evt.type === 'checkout.session.completed') {
			await handleCheckoutSessionCompleted(evt.data.object as Stripe.Checkout.Session);
		}
	} catch (err) {
		return res.status(400).send(`Webhook error: ${err.message}`);
	}

	res.sendStatus(200);
}));

// Start server
log.info( {
	app: 'webhook-stripe',
	action: 'start'
} );

db.connect(config.mongo, config.db as ConnectionOptions).then(() => {
	const listener = app.listen( config.stripe.port, config.host, function () {
		log.debug( {
			app: 'webhook-stripe',
			action: 'start-webserver',
			message: 'Started',
			address: listener.address()
		} );
	} );
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session ) {
	await GiftService.completeGiftFlow(session.id);
}

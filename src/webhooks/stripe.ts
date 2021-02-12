import 'module-alias/register';

import bodyParser from 'body-parser';
import express from 'express';
import Stripe from 'stripe';
import { ConnectionOptions } from 'typeorm';

import * as db from '@core/database';
import { log as mainLogger, installMiddleware } from '@core/logging';
import stripe from '@core/stripe';
import { wrapAsync } from '@core/utils';

import GiftService from '@core/services/GiftService';
import OptionsService from '@core/services/OptionsService';

import config from '@config';

const log = mainLogger.child({app: 'webhook-stripe'});

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
			action: 'got-webhook',
			data: {
				id: evt.id,
				type: evt.type
			}
		}, `Got webhook ${evt.id} ${evt.type}`);

		if (evt.type === 'checkout.session.completed') {
			await handleCheckoutSessionCompleted(evt.data.object as Stripe.Checkout.Session);
		}
	} catch (err) {
		log.error({
			action: 'error',
			error: err
		}, `Got webhook error: ${err.message}`);
		return res.status(400).send(`Webhook error: ${err.message}`);
	}

	res.sendStatus(200);
}));

const internalApp = express();

internalApp.post('/reload', wrapAsync(async (req, res) => {
	await OptionsService.reload();
	log.debug({ action: 'reload' });
	res.sendStatus(200);
}));

// Start server
log.info( {
	action: 'start'
} );

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	await OptionsService.reload();

	app.listen( config.stripe.port, config.host, function () {
		log.debug( {action: 'start-webserver'} );
	} );

	internalApp.listen(config.internalPort, config.host, () => {
		log.debug( {action: 'internal-webserver-started'} );
	});
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session ) {
	await GiftService.completeGiftFlow(session.id);
}

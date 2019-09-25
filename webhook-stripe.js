global.__root = __dirname;
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

const bodyParser = require('body-parser');
const express = require( 'express' );

const config = require( __config );

const { GiftFlows } = require( __js + '/database' ).connect( config.mongo );
const log = require( __js + '/logging' ).log;
const stripe = require( __js + '/stripe' );
const { wrapAsync } = require( __js + '/utils' );

const app = express();

require( __js + '/logging' ).installMiddleware( app );

app.use(bodyParser.raw({type: 'application/json'}));

app.get( '/ping', (req, res) => {
	req.log.info( {
		app: 'webhook-stripe',
		action: 'ping'
	} );
	res.sendStatus( 200 );
} );

app.post( '/', wrapAsync(async (req, res) => {
	const sig = req.headers['stripe-signature'];

	try {
		const evt = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhook_secret);

		log.info({
			app: 'webhook-stripe',
			action: 'got-webhook',
			type: evt.type
		});

		if (evt.type === 'checkout.session.completed') {
			await handleCheckoutSessionCompleted(evt.data.object);
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

const listener = app.listen( config.stripe.port, config.host, function () {
	log.debug( {
		app: 'webhook-stripe',
		action: 'start-webserver',
		message: 'Started',
		address: listener.address()
	} );
} );

async function handleCheckoutSessionCompleted(session) {
	const giftFlow = await GiftFlows.findOne({sessionId: session.id});
	if (giftFlow) {
		log.info({
			app: 'webhook-stripe',
			action: 'complete-gift',
			giftId: giftFlow._id
		});
		await giftFlow.update({$set: {completed: true}});
	} else {
		log.error({
			app: 'webhook-stripe',
			action: 'complete-checkout',
			error: 'Could not find matching gift flow'
		});
	}
}

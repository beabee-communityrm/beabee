require('module-alias/register');

const bodyParser = require('body-parser');
const express = require( 'express' );
const hummus = require( 'hummus' );
const moment = require( 'moment' );

const config = require( '@config' );

const db = require( '@core/database' );
const log = require( '@core/logging' ).log;
const mandrill = require( '@core/mandrill' );
const stripe = require( '@core/stripe' );
const { wrapAsync } = require( '@core/utils' );
const { processGiftFlow, isBeforeCutOff } = require( '@apps/gift/utils' );

const app = express();

function createGiftCard(code) {
	const inStream = new hummus.PDFRStreamForFile(__dirname + '/static/pdfs/gift.pdf');

	const outStream = new hummus.PDFWStreamForBuffer();

	const pdfWriter = hummus.createWriterToModify(inStream, outStream);
	const font = pdfWriter.getFontForFile(__dirname + '/static/fonts/Lato-Regular.ttf');

	const pageModifier = new hummus.PDFPageModifier(pdfWriter, 0, true);
	const context = pageModifier.startContext().getContext();

	context.cm(-1, 0, 0, -1, 406, 570);
	context.writeText(
		'thebristolcable.org/gift/' + code, 0, 0, {
			font,
			size: 14,
			color: 0x000000
		}
	);

	pageModifier.endContext().writePage();
	pdfWriter.end();

	return outStream.buffer;
}

require( '@core/logging' ).installMiddleware( app );

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

db.connect(db.mongo).then(() => {
	const listener = app.listen( config.stripe.port, config.host, function () {
		log.debug( {
			app: 'webhook-stripe',
			action: 'start-webserver',
			message: 'Started',
			address: listener.address()
		} );
	} );
});

async function handleCheckoutSessionCompleted(session) {
	const giftFlow = await db.GiftFlows.findOne({sessionId: session.id});
	if (giftFlow) {
		log.info({
			app: 'webhook-stripe',
			action: 'complete-gift',
			giftId: giftFlow._id
		});

		await giftFlow.update({$set: {completed: true}});

		const { fromName, fromEmail, firstname, startDate } = giftFlow.giftForm;
		const now = moment.utc();
		const beforeCutOff = isBeforeCutOff(now);

		const giftCard = beforeCutOff ? null : createGiftCard(giftFlow.setupCode);
		const emailTemplate = beforeCutOff ? 'purchased-gift-with-card-before-16th-dec' : 'purchased-gift';

		await mandrill.sendMessage(emailTemplate, {
			to: [{
				email: fromEmail,
				name:  fromName
			}],
			merge_vars: [{
				rcpt: fromEmail,
				vars: [{
					name: 'PURCHASER',
					content: fromName,
				}, {
					name: 'GIFTEE',
					content: firstname
				}, {
					name: 'GIFTDATE',
					content: moment.utc(startDate).format('MMMM Do')
				}]
			}],
			...(giftCard && {
				attachments: [{
					type: 'application/pdf',
					name: 'Gift card.pdf',
					content: giftCard.toString('base64')
				}]
			})
		});

		// Immediately process gifts for today
		if (moment.utc(startDate).isSame(now, 'day')) {
			log.info( {
				app: 'webhook-stripw',
				action: 'process-gift',
				giftFlowId: giftFlow._id
			} );
			await processGiftFlow(giftFlow, true);
		}
	} else {
		log.error({
			app: 'webhook-stripe',
			action: 'complete-checkout',
			error: 'Could not find matching gift flow'
		});
	}
}

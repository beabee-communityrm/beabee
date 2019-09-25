const express = require( 'express' );
const stripe = require( __js + '/stripe' );

const config = require( __config );

const { GiftFlows } = require( __js + '/database' );
const { hasModel, hasSchema } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const { createGiftSchema } = require( './schema.json' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.activeApp = app_config.uid;
	next();
} );

app.get( '/', ( req, res ) => {
	res.render( 'index', { stripePublicKey: config.stripe.public_key } );
} );

app.post( '/', hasSchema( createGiftSchema ).orReplyWithJSON, wrapAsync( async ( req, res ) => {
	const session = await stripe.checkout.sessions.create({
		success_url: config.audience + '/gift/complete?session_id={CHECKOUT_SESSION_ID}',
		cancel_url: config.audience + '/gift',
		payment_method_types: ['card'],
		line_items: [{
			name: 'Gift membership',
			amount: 3600,
			currency: 'gbp',
			quantity: 1
		}]
	});

	await GiftFlows.create({
		sessionId: session.id,
		giftForm: req.body
	});

	res.send({sessionId: session.id});
} ) );

app.get( '/complete', wrapAsync( async ( req, res ) => {
	const giftFlow = await GiftFlows.findOne({sessionId: req.query.session_id});
	if (giftFlow) {
		if (giftFlow.completed) {
			res.redirect('/gift/thanks/' + giftFlow._id);
		} else {
			res.redirect('/gift/failed');
		}
	} else {
		res.status(404).send('Not found');
	}
} ) );

app.get( '/thanks/:_id', hasModel(GiftFlows, '_id'),  ( req, res ) => {
	if (req.model.completed) {
		res.render('thanks', req.model.giftForm);
	} else {
		res.redirect('/gift/failed');
	}
} );

app.post( '/thanks/:_id', hasModel(GiftFlows, '_id'), wrapAsync( async ( req, res ) => {
	if (!req.model.giftForm.delivery_address.line1) {
		await req.model.update({$set: {
			'giftForm.delivery_address': {
				line1: req.body.delivery_line1,
				line2: req.body.delivery_line2,
				city: req.body.delivery_city,
				postcode: req.body.delivery_postcode
			}
		}});
	}

	res.redirect( req.originalUrl );
} ) );

app.get( '/failed', ( req, res ) => {
	res.send('failed');
} );

module.exports = function( config ) {
	app_config = config;
	return app;
};

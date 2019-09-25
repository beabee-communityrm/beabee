const express = require( 'express' );
const stripe = require( __js + '/stripe' );

const config = require( __config );

const { GiftFlows } = require( __js + '/database' );
const { hasSchema } = require( __js + '/middleware' );
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
		success_url: config.audience + '/gift/thanks?sessionId={CHECKOUT_SESSION_ID}',
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

app.get( '/thanks', wrapAsync( async ( req, res ) => {
	res.send('');
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};

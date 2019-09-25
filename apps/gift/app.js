const express = require( 'express' );
const stripe = require( __js + '/stripe' );

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
	res.render( 'index' );
} );

app.post( '/', hasSchema( createGiftSchema ).orReplyWithJSON, wrapAsync( async ( req, res ) => {
	res.send(req.body);
} ) );

app.get( '/thanks', wrapAsync( async ( req, res ) => {
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};

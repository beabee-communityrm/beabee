const express = require( 'express' );

const auth = require( __js + '/authentication' );

const discountCodes = require(__root + '/discountCodes.json');

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( ( req, res, next ) => {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	res.locals.activeApp = app_config.uid;
	next();
} );

app.get( '/undercover-with-the-alt-right', auth.isLoggedIn, ( req, res ) => {
	const discount = discountCodes[req.user.uuid];
	if (discount) {
		res.redirect('https://www.eventbrite.co.uk/e/private-film-screening-undercover-with-the-alt-right-tickets-56401946741?discount=' + discount);
	} else {
		throw new Error('No discount code found for ' + req.user.uuid);
	}
} );

module.exports = config => {
	app_config = config;
	return app;
};

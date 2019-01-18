const express = require( 'express' );
const moment = require( 'moment' );

const auth = require( __js + '/authentication' );
const { PollAnswers } = require( __js + '/database' );
const { wrapAsync } = require( __js + '/utils' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	res.locals.activeApp = app_config.uid;

	if ( req.user ) {
		if (req.user.memberPermission && req.user.memberPermission.date_expires < moment() &&
				req.originalUrl !== '/profile/expired') {
			res.redirect('/profile/expired');
		} else if (!req.user.setupComplete && req.originalUrl !== '/profile/complete') {
			res.redirect('/profile/complete');
		} else {
			next();
		}
	} else {
		next();
	}
} );

app.get( '/', wrapAsync( async function( req, res ) {
	const hasAnswered = await PollAnswers.findOne( { member: req.user } );
	res.render( 'profile', { user: req.user, hasAnswered } );
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};

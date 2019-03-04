const express = require( 'express' );
const passport = require( 'passport' );

const { isValidNextUrl, getNextParam } = require( __js + '/utils' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.activeApp = app_config.uid;
	next();
} );

app.get( '/' , function( req, res ) {
	if ( ! req.user.otp.activated ) {
		req.flash( 'warning', '2fa-unnecessary' );
		res.redirect( '/profile/2fa' );
	} else if ( req.user.otp.activated && req.session.method === 'totp' ) {
		req.flash( 'warning', '2fa-already-complete' );
		res.redirect( '/profile' );
	} else {
		res.render( 'index' );
	}
} );

app.post( '/',function ( req, res ) {
	passport.authenticate( 'totp', {
		failureRedirect: '/otp' + getNextParam( req.query.next ),
		failureFlash: '2fa-invalid'
	} )( req, res, () => {
		req.session.method = 'totp';
		res.redirect( isValidNextUrl( req.query.next ) ? req.query.next : '/profile' );
	} );
} );

app.get( '/cancel', function( req, res ) {
	res.redirect( '/logout' );
} );

module.exports = function( config ) {
	app_config = config;
	return app;
};

var __root = '../../../..';
var __src = __root + '/src';
var __js = __src + '/js';
var __config = __root + '/config';

var	express = require( 'express' ),
	app = express();

var auth = require( __js + '/authentication' ),
	discourse = require( __js + '/discourse' ),
	db = require( __js + '/database' ),
	Permissions = db.Permissions,
	Members = db.Members;

var TOTP = require( 'notp' ).totp;
var base32 = require( 'thirty-two' );

var messages = require( __src + '/messages.json' );

var config = require( __config + '/config.json' );

var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.parent.mountpath + app.mountpath
	} );
	res.locals.activeApp = app_config.uid;
	next();
} );

app.get( '/', auth.isLoggedIn, function( req, res ) {
	res.render( 'index', { user: req.user } );
} );

app.get( '/setup', auth.isLoggedIn, function( req, res ) {
	auth.generateOTPSecret( function( secret ) {
		var url = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=otpauth://totp/' + req.user.email + '?secret=' + secret;
		res.render( 'setup', {
			qr: url,
			secret: secret
		} );
	} );
} );

app.post( '/setup', auth.isLoggedIn, function( req, res ) {
	var test = TOTP.verify( req.body.code, base32.decode( req.body.secret ) );
	if ( test && Math.abs( test.delta ) < 2 ) {
		req.user.otp.key = req.body.secret;
		req.user.save( function( err ) {
			req.flash( 'success', messages['2fa-enabled'] );
			res.redirect( '/profile/2fa' );
		} );
	} else {
		req.flash( 'danger', messages['2fa-setup-failed'] );
		res.redirect( '/profile/2fa' );
	}
} );

app.get( '/disable', auth.isLoggedIn, function( req, res ) {
	res.render( 'disable' );
} );

app.post( '/disable', auth.isLoggedIn, function( req, res ) {
	req.user.otp.key = '';
	req.user.save( function( err ) {
		req.flash( 'success', messages['2fa-disabled'] );
		res.redirect( '/profile/2fa' );
	} );
} );

module.exports = function( config ) {
	app_config = config;
	return app;
};

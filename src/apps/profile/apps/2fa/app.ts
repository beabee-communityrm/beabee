import express from 'express';
import { totp } from 'notp';
import base32 from 'thirty-two';
import querystring from 'querystring';

import auth from '@core/authentication';
import { wrapAsync } from '@core/utils';

import OptionsService from '@core/services/OptionsService';

import config from '@config';

const app = express();
let app_config;

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/', auth.isLoggedIn, function( req, res ) {
	res.render( 'index', { user: req.user } );
} );

app.get( '/setup', auth.isLoggedIn, wrapAsync( async function( req, res ) {
	if ( req.user.otp.activated ) {
		req.flash( 'danger', '2fa-already-enabled' );
		res.redirect( '/profile/2fa' );
		return;
	}

	const secret = await auth.generateOTPSecretPromise();

	await req.user.update( { $set: { 'otp.key': secret } } );

	const otpoptions = querystring.stringify( {
		issuer: ( ( config.dev ) ? ' [DEV] ' : '' ) + OptionsService.getText( 'organisation' ),
		secret: secret
	} );
	const otpissuerName = encodeURIComponent( OptionsService.getText( 'organisation' ) + ( ( config.dev ) ? '_dev' : '' ) );
	const otpauth = 'otpauth://totp/' + otpissuerName + ':' + req.user.email + '?' + otpoptions;
	const url = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent( otpauth );

	res.render( 'setup', {
		qr: url,
		secret: secret
	} );
} ) );

app.post( '/setup', auth.isLoggedIn, wrapAsync( async function( req, res ) {
	if ( req.user.otp.activated ) {
		req.flash( 'danger', '2fa-already-enabled' );
		res.redirect( '/profile/2fa' );
		return;
	}
	const test = totp.verify( req.body.code, base32.decode( req.user.otp.key ) );
	if ( test && Math.abs( test.delta ) < 2 ) {
		req.session.method = 'totp';

		await req.user.update({$set: {'otp.activated': true}});

		req.flash( 'success', '2fa-enabled' );
		res.redirect( '/profile/2fa' );
	} else {
		req.flash( 'danger', '2fa-setup-failed' );
		res.redirect( '/profile/2fa' );
	}
} ) );

app.get( '/disable', auth.isLoggedIn, function( req, res ) {
	if ( req.user.otp.activated ) {
		res.render( 'disable' );
	} else {
		req.flash( 'warning', '2fa-already-disabled' );
		res.redirect('/profile/2fa');
	}
} );

app.post( '/disable', auth.isLoggedIn, wrapAsync( async function( req, res ) {
	const test = totp.verify( req.body.code, base32.decode( req.user.otp.key ) );
	const hash = await auth.hashPasswordPromise( req.body.password, req.user.password.salt, req.user.password.iterations );
	if ( test && Math.abs( test.delta ) < 2 && hash === req.user.password.hash ) {
		await req.user.update({$set: {
			'otp.activated': false,
			'otp.key': ''
		}});
		req.flash( 'success', '2fa-disabled' );
		res.redirect( '/profile/2fa' );
	} else {
		req.flash( 'warning', '2fa-unable-to-disable' );
		res.redirect( '/profile/2fa/disable' );
	}
} ) );

export default function( config ): express.Express {
	app_config = config;
	return app;
}

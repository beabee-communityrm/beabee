import express from 'express';
import { totp } from 'notp';
import base32 from 'thirty-two';
import querystring from 'querystring';

import { generateOTPSecret, hashPassword } from '@core/authentication';
import { isLoggedIn } from '@core/middleware';
import { hasUser, wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';
import OptionsService from '@core/services/OptionsService';

import config from '@config';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isLoggedIn);

app.get( '/', function( req, res ) {
	res.render( 'index', { user: req.user } );
} );

app.get( '/setup', wrapAsync( hasUser(async function( req, res ) {
	if ( req.user.otp.activated ) {
		req.flash( 'danger', '2fa-already-enabled' );
		res.redirect( '/profile/2fa' );
		return;
	}

	const secret = await generateOTPSecret();

	await MembersService.updateMember(req.user, {
		otp: {key: secret, activated: false}
	});

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
} ) ) );

app.post( '/setup', wrapAsync( hasUser( async function( req, res ) {
	if ( req.user.otp.activated ) {
		req.flash( 'danger', '2fa-already-enabled' );
		res.redirect( '/profile/2fa' );
		return;
	}
	const test = totp.verify( req.body.code, base32.decode( req.user.otp.key || '' ) );
	if ( test && Math.abs( test.delta ) < 2 ) {
		req.session.method = 'totp';

		await MembersService.updateMember(req.user, {
			otp: {key: req.user.otp.key, activated: true}
		});

		req.flash( 'success', '2fa-enabled' );
		res.redirect( '/profile/2fa' );
	} else {
		req.flash( 'danger', '2fa-setup-failed' );
		res.redirect( '/profile/2fa' );
	}
} ) ) );

app.get( '/disable', hasUser(function( req, res ) {
	if ( req.user.otp.activated ) {
		res.render( 'disable' );
	} else {
		req.flash( 'warning', '2fa-already-disabled' );
		res.redirect('/profile/2fa');
	}
} ) );

app.post( '/disable', wrapAsync( hasUser(async function( req, res ) {
	const test = totp.verify( req.body.code, base32.decode( req.user.otp.key || '' ) );
	const hash = await hashPassword( req.body.password, req.user.password.salt, req.user.password.iterations );
	if ( test && Math.abs( test.delta ) < 2 && hash === req.user.password.hash ) {
		await MembersService.updateMember(req.user, {otp: {activated: false}});
		req.flash( 'success', '2fa-disabled' );
		res.redirect( '/profile/2fa' );
	} else {
		req.flash( 'warning', '2fa-unable-to-disable' );
		res.redirect( '/profile/2fa/disable' );
	}
} ) ) );

export default app;

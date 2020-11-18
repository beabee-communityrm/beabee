import express from 'express';
import passport from 'passport';

import { isValidNextUrl, getNextParam } from '@core/utils';

const app = express();
let app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
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
	const nextParam = req.query.next as string;
	passport.authenticate( 'totp', {
		failureRedirect: '/otp' + getNextParam( nextParam ),
		failureFlash: '2fa-invalid'
	} )( req, res, () => {
		req.session.method = 'totp';
		res.redirect( isValidNextUrl( nextParam ) ? nextParam : '/profile' );
	} );
} );

app.get( '/cancel', function( req, res ) {
	res.redirect( '/logout' );
} );

export default function( config ): express.Express {
	app_config = config;
	return app;
}

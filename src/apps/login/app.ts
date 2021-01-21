import express from 'express';
import passport from 'passport';

import { Members } from '@core/database';
import { isValidNextUrl, getNextParam, loginAndRedirect, wrapAsync, AppConfig } from '@core/utils';

const app = express();
let app_config: AppConfig;

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/' , function( req, res ) {
	const nextParam = req.query.next as string;
	if ( req.user ) {
		res.redirect( isValidNextUrl(nextParam) ? nextParam : '/profile' );
	} else {
		res.render( 'index', { nextParam: getNextParam( nextParam ) } );
	}
} );

app.get( '/:code', wrapAsync( async function( req, res ) {
	const nextParam = req.query.next as string;
	const member = await Members.findOne( {
		'loginOverride.code': req.params.code,
		'loginOverride.expires': {$gt: new Date()}
	} );

	if (member) {
		await member.update({$unset: {loginOverride: 1}});

		loginAndRedirect(req, res, member, isValidNextUrl(nextParam) ? nextParam : '/profile');
	} else {
		req.flash('error', 'login-code-invalid');
		res.redirect( '/login' );
	}
} ) );

app.post( '/', (req, res) => {
	const nextParam = req.query.next as string;
	passport.authenticate( 'local', {
		failureRedirect: '/login' + getNextParam( nextParam ),
		failureFlash: true
	} )( req, res, () => {
		req.session.method = 'plain';
		res.redirect( isValidNextUrl( nextParam ) ? nextParam : '/profile' );
	} );
} );

export default function (config: AppConfig): express.Express {
	app_config = config;
	return app;
}

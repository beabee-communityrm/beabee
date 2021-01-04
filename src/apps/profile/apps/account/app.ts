import express from 'express';

import auth from '@core/authentication';
import { hasSchema } from '@core/middleware';
import { AppConfig, cleanEmailAddress, hasUser, wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';

import { updateSchema } from './schemas.json';

const app = express();
let app_config: AppConfig;

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/', auth.isLoggedIn, function( req, res ) {
	res.render( 'index', { user: req.user } );
} );

app.post( '/', [
	auth.isLoggedIn,
	hasSchema(updateSchema).orFlash
], wrapAsync( hasUser(async function( req, res ) {
	const { body: { email, firstname, lastname } } = req;
	const cleanedEmail = cleanEmailAddress(email);

	try {
		await MembersService.updateMember(req.user, {
			email: cleanedEmail, firstname, lastname
		});

		req.flash( 'success', 'account-updated' );
	} catch ( error ) {
		// Duplicate key (on email)
		if ( error.code === 11000 ) {
			req.flash( 'danger', 'email-duplicate' );
		} else {
			throw error;
		}
	}

	res.redirect( '/profile/account');
} ) ) );

export default function( config: AppConfig ): express.Express {
	app_config = config;
	return app;
}

import	express from 'express';

import auth from '@core/authentication';
import { hasSchema } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';

import { changePasswordSchema } from './schemas.json';

const app = express();
let app_config;

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/', auth.isLoggedIn, function( req, res ) {
	res.render( 'index' );
} );

app.post( '/', [
	auth.isLoggedIn,
	hasSchema( changePasswordSchema ).orFlash
], wrapAsync( async function( req, res ) {
	const { body, user } = req;

	const hash = await auth.hashPasswordPromise( body.current, user.password.salt, user.password.iterations );

	if ( hash != user.password.hash ) {
		req.log.debug( {
			app: 'profile',
			action: 'change-password',
			error: 'Current password does not match users password',
		} );
		req.flash( 'danger', 'password-invalid' );
		res.redirect('/profile/change-password');
		return;
	}

	const password = await auth.generatePasswordPromise( body.new );

	await MembersService.updateMember(user, {
		password: {
			salt: password.salt,
			hash: password.hash,
			iterations: password.iterations,
			reset_code: null,
			tries: 0
		}
	});

	req.log.info( {
		app: 'profile',
		action: 'change-password'
	} );

	req.flash( 'success', 'password-changed' );
	res.redirect('/profile/change-password');
} ) );

export default function ( config ): express.Express {
	app_config = config;
	return app;
}

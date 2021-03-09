import	express from 'express';

import { hashPassword, generatePassword } from '@core/authentication';
import { hasSchema, isLoggedIn } from '@core/middleware';
import { hasUser, wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';

import { changePasswordSchema } from './schemas.json';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isLoggedIn);

app.get( '/', function( req, res ) {
	res.render( 'index', {hasPassword: !!req.user?.password.hash} );
} );

app.post( '/', hasSchema( changePasswordSchema ).orFlash, wrapAsync( hasUser( async function( req, res ) {
	const { body, user } = req;

	if (req.user.password.hash) {
		const hash = await hashPassword( body.current, user.password.salt, user.password.iterations );

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
	}

	await MembersService.updateMember(user, {
		password: await generatePassword(body.new)
	});

	req.log.info( {
		app: 'profile',
		action: 'change-password'
	} );

	req.flash( 'success', 'password-changed' );
	res.redirect('/profile/change-password');
} ) ) );

export default app;

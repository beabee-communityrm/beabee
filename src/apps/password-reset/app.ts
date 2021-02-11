import express from 'express';

import auth from '@core/authentication';
import { Members } from '@core/database';
import { hasSchema } from '@core/middleware';
import { cleanEmailAddress, loginAndRedirect, wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';
import OptionsService from '@core/services/OptionsService';

import { getResetCodeSchema, resetPasswordSchema } from './schemas.json';


const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isNotLoggedIn );

app.get( '/' , function( req, res ) {
	res.render( 'index' );
} );

app.post( '/', hasSchema(getResetCodeSchema).orFlash, wrapAsync( async function( req, res ) {
	const { body: { email } } = req;

	const member = await Members.findOne( { email: cleanEmailAddress(email) } );
	if (member) {
		await MembersService.resetMemberPassword(member);
	}

	const passwordResetMessage = OptionsService.getText('flash-password-reset') || '';
	req.flash( 'info', passwordResetMessage.replace( '%', email ) );

	res.redirect( app.mountpath as string );
} ) );

app.get( '/code', function( req, res ) {
	res.render( 'change-password' );
} );

app.get( '/code/:password_reset_code', function( req, res ) {
	res.render( 'change-password', { password_reset_code: req.params.password_reset_code } );
} );

app.post( '/code/:password_reset_code?', hasSchema(resetPasswordSchema).orFlash, wrapAsync( async function( req, res ) {
	const member = await Members.findOne( { 'password.reset_code': req.body.password_reset_code } );
	if (member) {
		const password = await auth.generatePasswordPromise( req.body.password );

		await member.update( { $set: {
			'password.salt': password.salt,
			'password.hash': password.hash,
			'password.reset_code': null,
			'password.tries': 0,
			'password.iterations': password.iterations
		} } );

		req.flash( 'success', 'password-changed' );

		loginAndRedirect( req, res, member );
	} else {
		req.flash('warning', 'password-reset-code-err');
		res.redirect( app.mountpath as string );
	}
} ) );

export default app;

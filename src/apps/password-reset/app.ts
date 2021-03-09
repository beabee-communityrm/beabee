import express from 'express';

import { generatePassword } from '@core/authentication';
import { hasSchema, isNotLoggedIn } from '@core/middleware';
import { cleanEmailAddress, loginAndRedirect, wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';
import OptionsService from '@core/services/OptionsService';

import { getResetCodeSchema, resetPasswordSchema } from './schemas.json';
import { getRepository } from 'typeorm';
import Member from '@models/Member';


const app = express();

app.set( 'views', __dirname + '/views' );

app.use( isNotLoggedIn );

app.get( '/' , function( req, res ) {
	res.render( 'index' );
} );

app.post( '/', hasSchema(getResetCodeSchema).orFlash, wrapAsync( async function( req, res ) {
	const { body: { email } } = req;

	await MembersService.resetMemberPassword(cleanEmailAddress(email));

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
	const member = await getRepository(Member).findOne({password: {resetCode: req.body.password_reset_code }});
	if (member) {
		await MembersService.updateMember(member, {
			password: await generatePassword( req.body.password )
		});

		req.flash( 'success', 'password-changed' );

		loginAndRedirect( req, res, member );
	} else {
		req.flash('warning', 'password-reset-code-err');
		res.redirect( app.mountpath as string );
	}
} ) );

export default app;

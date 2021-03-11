import passport from 'passport';
import passportLocal from 'passport-local';
import passportTotp from 'passport-totp';
import base32 from 'thirty-two';
import { getRepository } from 'typeorm';

import config from '@config';

import { cleanEmailAddress, sleep } from '@core/utils';
import { generatePassword, hashPassword } from '@core/utils/auth';

import OptionsService from '@core/services/OptionsService';
import MembersService from '@core/services/MembersService';

import Member  from '@models/Member';

// Add support for local authentication in Passport.js
passport.use( new passportLocal.Strategy( {
	usernameField: 'email'
}, async function( email, password, done ) {
	if ( email ) email = cleanEmailAddress(email);

	const user = await getRepository(Member).findOne( { email } );
	if (user) {
		const tries = user.password.tries || 0;
		// Has account exceeded it's password tries?
		if ( tries >= config['password-tries'] ) {
			return done( null, false, { message: 'account-locked' } );
		}

		if ( !user.password.salt ) {
			return done( null, false, { message: 'login-failed' } );
		}

		const hash = await hashPassword( password, user.password.salt, user.password.iterations );
		if ( hash === user.password.hash ) {
			if ( user.password.resetCode ) {
				await MembersService.updateMember(user, {password: {...user.password, resetCode: undefined}});
				return done( null, user, { message: 'password-reset-attempt' } );
			}

			if ( tries > 0 ) {
				await MembersService.updateMember(user, {password: {...user.password, tries: 0}});
				return done( null, user, { message: OptionsService.getText( 'flash-account-attempts' ).replace( '%', tries.toString() ) } );
			}

			if ( user.password.iterations < config.iterations ) {
				await MembersService.updateMember(user, {password: await generatePassword(password)});
			}

			return done( null, user, { message: 'logged-in' } );
		} else {
			// If password doesn't match, increment tries and save
			user.password.tries = tries + 1;
			await MembersService.updateMember(user, {password: {...user.password, tries: tries + 1}});
		}
	}

	// Delay by 1 second to slow down password guessing
	await sleep(1000);
	return done( null, false, { message: 'login-failed' } );
} ) );

// Add support for TOTP authentication in Passport.js
passport.use( new passportTotp.Strategy( {
	window: 1,
}, function( _user, done ) {
	const user = _user as Member;
	if ( user.otp.key ) {
		return done( null, base32.decode( user.otp.key ).toString(), 30 );
	}
	return done( null, false );
})
);


// Passport.js serialise user function
passport.serializeUser( function( data, done ) {
	done( null, (data as Member).id );
} );

// Passport.js deserialise user function
passport.deserializeUser( async function( data, done ) {
	const member = await getRepository(Member).findOne( data as string );
	if ( member ) {
		await MembersService.updateMember(member, {lastSeen: new Date()});

		const user = member as Express.User;
		user.quickPermissions = [
			'loggedIn',
			...member.permissions.filter(p => p.isActive).map(p => p.permission)
		];
		return done( null, user );
	} else {
		return done( null, false );
	}
} );

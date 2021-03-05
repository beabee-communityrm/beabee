import crypto from 'crypto';
import express, { Request, Response } from 'express';
import passport from 'passport';
import passportLocal from 'passport-local';
import passportTotp from 'passport-totp';
import base32 from 'thirty-two';
import { getRepository } from 'typeorm';

import config from '@config';

import { Members } from '@core/database';
import { cleanEmailAddress, getNextParam, sleep } from '@core/utils';

import OptionsService from '@core/services/OptionsService';

import MemberPermission, { PermissionType } from '@models/MemberPermission';
import { Member } from '@models/members';

export enum AuthenticationStatus {
	LOGGED_IN = 1,
	NOT_LOGGED_IN = 0,
	NOT_MEMBER = -1,
	NOT_ADMIN = -2,
	REQUIRES_2FA = -3
}

interface PassportUser {
	_id: string
}

export function load( app: express.Express ): void {
	// Add support for local authentication in Passport.js
	passport.use( new passportLocal.Strategy( {
		usernameField: 'email'
	}, async function( email, password, done ) {
		if ( email ) email = cleanEmailAddress(email);

		const user = await Members.findOne( { email } );
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
				const passportUser: PassportUser = {_id: user.id };

				if ( user.password.reset_code ) {
					user.password.reset_code = undefined;
					await user.save();
					return done( null, passportUser, { message: 'password-reset-attempt' } );
				}

				if ( tries > 0 ) {
					user.password.tries = 0;
					await user.save();
					return done( null, passportUser, { message: OptionsService.getText( 'flash-account-attempts' ).replace( '%', tries.toString() ) } );
				}

				if ( user.password.iterations < config.iterations ) {
					user.password = await generatePassword(password);
					await user.save();
				}

				return done( null, passportUser, { message: 'logged-in' } );
			} else {
				// If password doesn't match, increment tries and save
				user.password.tries = tries + 1;
				await user.save();
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
		done( null, data );
	} );

	// Passport.js deserialise user function
	passport.deserializeUser( async function( data, done ) {
		const passportUser = data as PassportUser;
		const member = await Members.findById( passportUser._id );
		if ( member ) {
			// Update last seen
			member.last_seen = new Date();
			await member.save();

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

	// Include support for passport and sessions
	app.use( passport.initialize() );
	app.use( passport.session() );
}

// Used for generating an OTP secret for 2FA
// returns a base32 encoded string of random bytes
export function generateOTPSecret(): Promise<string> {
	return new Promise(resolve => {
		crypto.randomBytes( 16, function( ex, raw ) {
			const secret = base32.encode( raw );
			resolve(secret.toString().replace(/=/g, ''));
		} );
	});
}

export function generateCode(): string {
	return crypto.randomBytes( 10 ).toString( 'hex' );
}

// Used to create a long salt for each individual user
// returns a 256 byte / 512 character hex string
export function generateSalt(): Promise<string> {
	return new Promise(resolve => {
		crypto.randomBytes( 256, function( ex, salt ) {
			resolve( salt.toString( 'hex' ) );
		} );
	});
}

// Hashes passwords through sha512 1000 times
// returns a 512 byte / 1024 character hex string
export function hashPassword( password: string, salt: string, iterations: number): Promise<string> {
	return new Promise(resolve => {
		crypto.pbkdf2( password, salt, iterations, 512, 'sha512', function( err, hash ) {
			resolve( hash.toString( 'hex' ) );
		} );
	});
}

// Utility function generates a salt and hash from a plain text password
export async function generatePassword( password: string ): Promise<{salt: string, hash: string, iterations: number}> {
	const salt = await generateSalt();
	const hash = await hashPassword(password, salt, config.iterations);
	return {
		salt, hash, iterations: config.iterations
	};
}

// Checks the user is logged in and activated.
export function loggedIn( req: Request ): AuthenticationStatus {
	// Is the user logged in?
	if ( req.isAuthenticated() && req.user ) {
		// Is the user active
		if ( ! req.user.otp.activated || ( req.user.otp.activated && req.session.method == 'totp' ) ) {
			return AuthenticationStatus.LOGGED_IN;
		} else {
			return AuthenticationStatus.REQUIRES_2FA;
		}
	} else {
		return AuthenticationStatus.NOT_LOGGED_IN;
	}
}

// Checks if the user has an active specified permission
function checkPermission( req: Request, permission: PermissionType ): boolean {
	return req.user ? req.user.quickPermissions.indexOf( permission ) !== -1 : false;
}

// Checks if the user has an active admin or superadmin privilage
export function canAdmin( req: Request ): AuthenticationStatus {
	// Check user is logged in
	const status = loggedIn( req );
	if ( status != AuthenticationStatus.LOGGED_IN ) {
		return status;
	} else {
		if ( checkPermission( req, 'superadmin' ) ) return AuthenticationStatus.LOGGED_IN;
		if ( checkPermission( req, 'admin' ) ) return AuthenticationStatus.LOGGED_IN;
	}
	return AuthenticationStatus.NOT_ADMIN;
}

// Checks if the user has an active superadmin privilage
export function canSuperAdmin( req: Request ): AuthenticationStatus {
	// Check user is logged in
	const status = loggedIn( req );
	if ( status != AuthenticationStatus.LOGGED_IN ) {
		return status;
	} else {
		if ( checkPermission( req, 'superadmin' ) ) return AuthenticationStatus.LOGGED_IN;
	}
	return AuthenticationStatus.NOT_ADMIN;
}

export function handleNotAuthed( status: AuthenticationStatus, req: Request, res: Response ): void {
	const nextUrl = req.method === 'GET' ? getNextParam(req.originalUrl) : '';

	switch ( status ) {
	case AuthenticationStatus.REQUIRES_2FA:
		res.redirect( '/otp' + nextUrl );
		return;
	default:
		req.flash( 'error', 'login-required' );
		res.redirect( '/login' + nextUrl );
		return;
	}
}
// Checks password meets requirements
export function passwordRequirements( password: string ): string|true {
	if ( ! password )
		return 'password-err-length';

	if ( password.length < 8 )
		return 'password-err-length';

	if ( password.match( /\d/g ) === null )
		return 'password-err-number';

	if ( password.match( /[A-Z]/g ) === null )
		return 'password-err-letter-up';

	if ( password.match( /[a-z]/g ) === null )
		return 'password-err-letter-low';

	return true;
}

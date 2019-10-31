const crypto = require( 'crypto' );
const base32 = require( 'thirty-two' );
const passport = require( 'passport' );
const LocalStrategy = require( 'passport-local' ).Strategy;
const TotpStrategy = require( 'passport-totp' ).Strategy;

const config = require( __config );

const { Members } = require( __js + '/database' );
const Options = require( __js + '/options.js' )();
const { cleanEmailAddress, getNextParam, sleep } = require( __js + '/utils' );

var Authentication = {
	load: function( app ) {

		// Add support for local authentication in Passport.js
		passport.use( new LocalStrategy( {
			usernameField: 'email'
		}, async function( email, password, done ) {

			if ( email ) email = cleanEmailAddress(email);

			const user = await Members.findOne( { email } );
			if ( user ) {
				// Has account exceeded it's password tries?
				if ( user.password.tries >= config['password-tries'] ) {
					return done( null, false, { message: 'account-locked' } );
				}

				if ( !user.password.salt ) {
					return done( null, false, { message: 'login-failed' } );
				}

				const hash = await Authentication.hashPasswordPromise( password, user.password.salt, user.password.iterations );
				if ( hash === user.password.hash ) {

					if ( user.password.reset_code ) {
						user.password.reset_code = null;
						await user.save();
						return done( null, { _id: user._id }, { message: 'password-reset-attempt' } );
					}

					if ( user.password.tries > 0 ) {
						const attempts = user.password.tries;
						user.password.tries = 0;
						await user.save();
						return done( null, { _id: user._id }, { message: Options.getText( 'flash-account-attempts' ).replace( '%', attempts ) } );
					}

					if ( user.password.iterations < config.iterations ) {
						const newPassword = await Authentication.generatePasswordPromise( password );

						user.password = {
							hash: newPassword.hash,
							salt: newPassword.salt,
							iterations: newPassword.iterations
						};
						await user.save();
					}

					return done( null, { _id: user._id }, { message: 'logged-in' } );
				} else {
					// If password doesn't match, increment tries and save
					user.password.tries++;
					await user.save();
				}
			}

			// Delay by 1 second to slow down password guessing
			await sleep(1000);
			return done( null, false, { message: 'login-failed' } );
		} ) );

		// Add support for TOTP authentication in Passport.js
		passport.use( new TotpStrategy( {
			window: 1,
		}, function( user, done ) {
			if ( user.otp.key ) {
				return done( null, base32.decode( user.otp.key ), 30 );
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
			const user = await Members.findById( data._id ).populate( 'permissions.permission' );
			if ( user ) {
				// Create array of permissions for user
				let permissions = [ 'loggedIn' ];

				// Update last seen
				user.last_seen = new Date();
				await user.save();

				// Loop through permissions check they are active right now and add those to the array
				for ( var p = 0; p < user.permissions.length; p++ ) {
					if ( user.permissions[p].date_added <= new Date() ) {
						if ( ! user.permissions[p].date_expires || user.permissions[p].date_expires > new Date() ) {
							permissions.push( user.permissions[p].permission.slug );
						}
					}
				}

				user.quickPermissions = permissions;

				// Return user data
				return done( null, user );
			} else {
				// Display login required message if user _id not found.
				return done( null, false, { message: 'login-required' } );
			}
		} );

		// Include support for passport and sessions
		app.use( passport.initialize() );
		app.use( passport.session() );
	},

	// Used for generating an OTP secret for 2FA
	// returns a base32 encoded string of random bytes
	generateOTPSecret: function( callback ) {
		crypto.randomBytes( 16, function( ex, raw ) {
			var secret = base32.encode( raw );
			secret = secret.toString().replace(/=/g, '');
			callback( secret );
		} );
	},

	// Used for generating activation codes for new accounts, discourse linking, and password reset
	// returns a 10 byte / 20 character hex string
	generateActivationCode: function( callback ) {
		crypto.randomBytes( 10, function( ex, code ) {
			callback( code.toString( 'hex' ) );
		} );
	},

	generateCode: function () {
		return crypto.randomBytes( 10 ).toString( 'hex' );
	},

	// Used to create a long salt for each individual user
	// returns a 256 byte / 512 character hex string
	generateSalt: function( callback ) {
		crypto.randomBytes( 256, function( ex, salt ) {
			callback( salt.toString( 'hex' ) );
		} );
	},

	// Hashes passwords through sha512 1000 times
	// returns a 512 byte / 1024 character hex string
	hashPassword: function( password, salt, iterations, callback ) {
		crypto.pbkdf2( password, salt, iterations, 512, 'sha512', function( err, hash ) {
			callback( hash.toString( 'hex' ) );
		} );
	},

	// Utility function generates a salt and hash from a plain text password
	generatePassword: function( password, callback ) {
		Authentication.generateSalt( function( salt ) {
			Authentication.hashPassword( password, salt, config.iterations, function( hash ) {
				callback( {
					salt: salt,
					hash: hash,
					iterations: config.iterations
				} );
			} );
		} );
	},

	hashPasswordPromise: function( password, salt, iterations ) {
		return new Promise(resolve => {
			Authentication.hashPassword( password, salt, iterations, resolve);
		});
	},

	generatePasswordPromise: function( password ) {
		return new Promise(resolve => {
			Authentication.generatePassword( password, resolve );
		});
	},

	generateOTPSecretPromise: function () {
		return new Promise(resolve => Authentication.generateOTPSecret(resolve));
	},

	LOGGED_IN: true,
	NOT_LOGGED_IN: false,
	NOT_MEMBER: -1,
	NOT_ADMIN: -2,
	REQUIRES_2FA: -3,

	// Checks the user is logged in and activated.
	loggedIn: function( req ) {
		// Is the user logged in?
		if ( req.isAuthenticated() && req.user ) {
			// Is the user active
			if ( ! req.user.otp.activated || ( req.user.otp.activated && req.session.method == 'totp' ) ) {
				return Authentication.LOGGED_IN;
			} else {
				return Authentication.REQUIRES_2FA;
			}
		} else {
			return Authentication.NOT_LOGGED_IN;
		}
	},

	// Checks if the user is an active member (has paid or has admin powers)
	activeMember: function( req ) {
		// Check user is logged in
		var status = Authentication.loggedIn( req );
		if ( status != Authentication.LOGGED_IN ) {
			return status;
		} else {
			if ( Authentication.checkPermission( req, 'member' ) ) return Authentication.LOGGED_IN;
			if ( Authentication.checkPermission( req, 'superadmin' ) ) return Authentication.LOGGED_IN;
			if ( Authentication.checkPermission( req, 'admin' ) ) return Authentication.LOGGED_IN;
		}
		return Authentication.NOT_MEMBER;
	},

	// Checks if the user has an active admin or superadmin privilage
	canAdmin: function( req ) {
		// Check user is logged in
		var status = Authentication.loggedIn( req );
		if ( status != Authentication.LOGGED_IN ) {
			return status;
		} else {
			if ( Authentication.checkPermission( req, 'superadmin' ) ) return Authentication.LOGGED_IN;
			if ( Authentication.checkPermission( req, 'admin' ) ) return Authentication.LOGGED_IN;
		}
		return Authentication.NOT_ADMIN;
	},

	// Checks if the user has an active superadmin privilage
	canSuperAdmin: function( req ) {
		// Check user is logged in
		var status = Authentication.loggedIn( req );
		if ( status != Authentication.LOGGED_IN ) {
			return status;
		} else {
			if ( Authentication.checkPermission( req, 'superadmin' ) ) return Authentication.LOGGED_IN;
		}
		return Authentication.NOT_ADMIN;
	},

	// Checks if the user has an active specified permission
	checkPermission: function( req, permission ) {
		if ( ! req.user ) return false;
		if ( permission == 'superadmin' ) {
			if ( req.user.quickPermissions.indexOf( config.permission.superadmin ) != -1 ) return Authentication.LOGGED_IN;
			return false;
		}
		if ( permission == 'admin' ) {
			if ( req.user.quickPermissions.indexOf( config.permission.admin ) != -1 ) return Authentication.LOGGED_IN;
			return false;
		}
		if ( permission == 'member' ) {
			if ( req.user.quickPermissions.indexOf( config.permission.member ) != -1 ) return Authentication.LOGGED_IN;
			return false;
		}
		if ( req.user.quickPermissions.indexOf( permission ) != -1 ) return Authentication.LOGGED_IN;
		return false;
	},

	handleNotAuthed( status, req, res ) {
		const nextUrl = req.method === 'GET' ? getNextParam(req.originalUrl) : '';

		switch ( status ) {
		case Authentication.REQUIRES_2FA:
			res.redirect( '/otp' + nextUrl );
			return;
		default:
			req.flash( 'error', 'login-required' );
			res.redirect( '/login' + nextUrl );
			return;
		}
	},

	// Express middleware to redirect logged out users
	isLoggedIn: function( req, res, next ) {
		const status = Authentication.loggedIn( req );

		switch ( status ) {
		case Authentication.LOGGED_IN:
			return next();
		default:
			Authentication.handleNotAuthed( status, req, res );
			return;
		}
	},

	isNotLoggedIn: function( req, res, next ) {
		var status = Authentication.loggedIn( req );
		switch ( status ) {
		case Authentication.NOT_LOGGED_IN:
			return next();
		default:
			req.flash( 'warning', 'already-logged-in' );
			res.redirect( '/profile' );
			return;
		}
	},

	// Express middleware to redirect inactive members
	isMember: function( req, res, next ) {
		var status = Authentication.activeMember( req );
		switch ( status ) {
		case Authentication.LOGGED_IN:
			return next();
		case Authentication.NOT_MEMBER:
			req.flash( 'warning', 'inactive-membership' );
			res.redirect( '/profile' );
			return;
		default:
			Authentication.handleNotAuthed( status, req, res );
			return;
		}
	},

	// Express middleware to redirect users without admin/superadmin privilages
	isAdmin: function( req, res, next ) {
		var status = Authentication.canAdmin( req );
		switch ( status ) {
		case Authentication.LOGGED_IN:
			return next();
		case Authentication.NOT_ADMIN:
			req.flash( 'warning', '403' );
			res.redirect( '/profile' );
			return;
		default:
			Authentication.handleNotAuthed( status, req, res );
			return;
		}
	},

	// Express middleware to redirect users without superadmin privilages
	isSuperAdmin: function( req, res, next ) {
		var status = Authentication.canSuperAdmin( req );
		switch ( status ) {
		case Authentication.LOGGED_IN:
			return next();
		case Authentication.NOT_ADMIN:
			req.flash( 'warning', '403' );
			res.redirect( '/profile' );
			return;
		default:
			Authentication.handleNotAuthed( status, req, res );
			return;
		}
	},

	// Hashes a members tag with a salt using md5, per the legacy membership system
	hashTag: function( id ) {
		var md5 = crypto.createHash( 'md5' );
		md5.update( config.tag_salt );
		md5.update( id.toLowerCase() );
		return md5.digest( 'hex' );
	},

	validateTag: function( tag ) {
		if ( tag.match( /^[0-9a-f]{8}$/i ) === null ) return 'tag-invalid-malformed';
		if ( tag == '21222324' ) return 'tag-invalid-visa';
		if ( tag == '01020304' ) return 'tag-invalid-android';
		if ( tag.match( /^0+$/ ) !== null ) return 'tag-invalid-amex';
		if ( tag.substr( 0, 2 ) == '08' ) return 'tag-invalid-long-uid';
		return false;
	},

	// Checks password meets requirements
	passwordRequirements: function( password ) {
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
};

module.exports = Authentication;

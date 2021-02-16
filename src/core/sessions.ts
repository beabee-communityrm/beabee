import body from 'body-parser';
import cleanDeep from 'clean-deep';
import cookie from 'cookie-parser';
import _pgSession from 'connect-pg-simple';
import csrf from 'csurf';
import express, { ErrorRequestHandler } from 'express';
import session from 'express-session';
import passport from 'passport';
import { getConnection } from 'typeorm';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

import config from '@config';

const pgSession = _pgSession(session);

export default (app: express.Express): void => {
	app.use( cookie() );
	app.use( session( {
		name: config.session,
		secret: config.secret,
		cookie: config.cookie,
		saveUninitialized: false,
		store: new pgSession({
			pool: (getConnection().driver as PostgresDriver).master
		}),
		resave: false,
		rolling: true
	} ) );

	// Form Body Parser
	app.use( body.urlencoded( { extended: true } ) );
	// Remove empty strings from form submissions
	app.use( ( req, res, next ) => {
		if ( req.headers['content-type'] === 'application/x-www-form-urlencoded' ) {
			req.body = cleanDeep( req.body, { emptyArrays: false, emptyObjects: false } );
		}
		next();
	} );
	app.use( body.json() );

	// Passport
	app.use( passport.initialize() );
	app.use( passport.session() );

	app.use( ( req, res, next ) => {
		const uuid = req.user && req.user.uuid || req.cookies.memberId;
		if ( uuid ) {
			res.cookie('memberId', uuid, {
				maxAge: 365 * 24 * 60 * 60 * 1000
			});
		}

		next();
	} );

	// CSRF
	app.use( csrf() );

	app.use( function ( err, req, res, next ) {
		if ( err.code == 'EBADCSRFTOKEN' ) {
			return res.status( 403 ).send( 'Error: Please make sure cookies are enabled. (CSRF token invalid)' );
		}
		next( err );
	} as ErrorRequestHandler );
};

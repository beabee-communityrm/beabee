import _pgSession from 'connect-pg-simple';
import express from 'express';
import session from 'express-session';
import { getConnection } from 'typeorm';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

import passport from '@core/lib/passport';

import config from '@config';

const pgSession = _pgSession(session);

export default (app: express.Express): void => {
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

	// Passport
	app.use( passport.initialize() );
	app.use( passport.session() );

	app.use( ( req, res, next ) => {
		const memberId = req.user?.id || req.cookies.memberId;
		if ( memberId ) {
			res.cookie('memberId', memberId, {
				maxAge: 365 * 24 * 60 * 60 * 1000
			});
		}

		next();
	} );
};

import 'module-alias/register';

import cleanDeep from 'clean-deep';
import cookie from 'cookie-parser';
import csrf from 'csurf';
import express, { ErrorRequestHandler } from 'express';
import flash from 'express-flash';
import helmet from 'helmet';

import appLoader from '@core/app-loader';
import * as database from '@core/database';
import { log, installMiddleware as installLogMiddleware } from '@core/logging';
import quickflash from '@core/quickflash';
import sessions from '@core/sessions';

import OptionsService, { OptionKey } from '@core/services/OptionsService';
import PageSettingsService from '@core/services/PageSettingsService';

//import specialUrlHandler from '@apps/tools/apps/special-urls/handler';

import config from '@config';

if ( !config.gocardless.sandbox && config.dev ) {
	log.error({
		app: 'main',
		error: 'Dev mode enabled but GoCardless is not in sandbox, refusing to start'
	});
	process.exit(1);
}

log.info( {
	app: 'main',
	action: 'start'
} );

const app = express();

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'pug' );
app.set( 'view cache', false );

// Add logging capabilities
installLogMiddleware( app );

// Use helmet
app.use( helmet( { contentSecurityPolicy: false } ) );
app.use( cookie() );

database.connect().then(async () => {
	// Load some caches and make them immediately available
	await PageSettingsService.reload();
	app.use((req, res, next) => {
		res.locals.Options = (opt: OptionKey) => OptionsService.getText(opt);
		res.locals.Options.list = (opt: OptionKey) => OptionsService.getList(opt);
		res.locals.pageSettings = PageSettingsService.getPath(req.path);
		next();
	});

	// Setup tracker
	app.use( '/membership.js', (req, res) => {
		const referrerUrl = req.get('referer');
		res.set('Content-Type', 'application/javascript');
		if (!referrerUrl || config.trackDomains.some(domain => referrerUrl.startsWith(domain))) {
			const memberId = req.cookies.memberId;
			if (memberId) {
				res.send('window.Membership = {memberId: "' + memberId + '"}');
			} else {
				res.send('window.Membership = {}');
			}
		} else {
			res.status(404).send('');
		}
	});

	// Form Body Parser
	app.use( express.urlencoded( { extended: true } ) );

	// Remove empty strings from form submissions
	app.use( ( req, res, next ) => {
		if ( req.headers['content-type'] === 'application/x-www-form-urlencoded' ) {
			req.body = cleanDeep( req.body, { emptyArrays: false, emptyObjects: false } );
		}
		next();
	} );
	//app.use( express.json() );

	// Handle sessions
	sessions( app );

	app.use( ( req, res, next ) => {
		const memberId = req.user?.id || req.cookies.memberId;
		if ( memberId ) {
			res.cookie('memberId', memberId, {
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

	// Include support for notifications
	app.use( flash() );
	app.use( quickflash );

	// Load apps
	await appLoader( app );

	// Hook to handle special URLs
	//app.use( '/s', specialUrlHandler );

	// Error 404
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	app.use( function ( req, res, next ) {
		res.status( 404 );
		res.render( '404' );
	} );

	// Error 500
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	app.use( function ( err, req, res, next ) {
		res.status( 500 );
		res.render( '500', { error: ( config.dev ? err.stack : undefined ) } );

		log.error({
			action: 'uncaught-error',
			error: err
		});
	} as ErrorRequestHandler );

	// Start server
	const server = app.listen( 3000, '0.0.0.0', function () {
		log.debug( {
			app: 'main',
			action: 'start-webserver',
			message: 'Started',
			address: server.address()
		} );
	} );

	process.on('SIGTERM', () => {
		log.debug( {
			app: 'main',
			action: 'stop-webserver',
			message: 'Waiting for server to shutdown'
		} );

		database.close();

		setTimeout(() => {
			log.debug( {
				app: 'main',
				action: 'stop-webserver',
				message: 'Server was forced to shutdown after timeout'
			} );
			process.exit(1);
		}, 20000).unref();

		server.close(() => process.exit());
	});
});

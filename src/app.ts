import 'module-alias/register';

import express, { ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import flash from 'express-flash';

import appLoader from '@core/app-loader';
import auth from '@core/authentication';
import * as database from '@core/database';
import { log, installMiddleware as installLogMiddleware } from '@core/logging';
import quickflash from '@core/quickflash';
import sessions from '@core/sessions';

import OptionsService from '@core/services/OptionsService';
import PageSettingsService from '@core/services/PageSettingsService';

import specialUrlHandler from '@apps/tools/apps/special-urls/handler';

import config from '@config';
import { ConnectionOptions } from 'typeorm';

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

// Setup static route (only used on dev)
app.use( '/static', express.static( __dirname + '/static' ) );

// Add logging capabilities
installLogMiddleware( app );

// Use helmet
app.use( helmet( { contentSecurityPolicy: false } ) );

database.connect( config.mongo, config.db as ConnectionOptions ).then(async () => {
	// Load some caches and make them immediately available
	await Promise.all([OptionsService.reload(), PageSettingsService.reload()]);
	app.use((req, res, next) => {
		res.locals.Options = (opt: string) => OptionsService.getText(opt);
		res.locals.pageSettings = PageSettingsService.getPath(req.path);
		next();
	});

	// Handle authentication
	auth.load( app );

	// Handle sessions
	sessions( app );

	// Include support for notifications
	app.use( flash() );
	app.use( quickflash );

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

	// Load apps
	await appLoader( app );

	// Hook to handle special URLs
	app.use( '/s', specialUrlHandler );

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
	const server = app.listen( config.port ,config.host, function () {
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

		server.close(() => {
			log.debug( {
				app: 'main',
				action: 'stop-webserver',
				message: 'Server successfully shutdown'
			} );
			process.exit();
		});
	});
});

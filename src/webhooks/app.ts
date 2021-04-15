import 'module-alias/register';

import express from 'express';

import * as db from '@core/database';
import { installMiddleware, log } from '@core/logging';
import { wrapAsync } from '@core/utils';

import OptionsService from '@core/services/OptionsService';

import gocardlessApp from './gocardless';
import stripeApp from './stripe';

const app = express();

// Add logging capabilities
installMiddleware( app );

app.get( '/ping', function( req, res ) {
	log.info( { action: 'ping' } );
	res.sendStatus( 200 );
} );

app.use('/gc', gocardlessApp);
app.use('/stripe', stripeApp);

const internalApp = express();

internalApp.post('/reload', wrapAsync(async (req, res) => {
	await OptionsService.reload();
	res.sendStatus(200);
}));

// Start server
log.info( {
	action: 'start'
} );

db.connect().then(async () => {
	const server = app.listen(3000, '0.0.0.0', function () {
		log.debug( {action: 'start-webserver'} );
	} );

	const internalServer = internalApp.listen(4000, '0.0.0.0', () => {
		log.debug( {action: 'internal-webserver-started'} );
	});

	process.on('SIGTERM', () => {
		log.debug( {
			app: 'main',
			action: 'stop-webserver',
			message: 'Waiting for server to shutdown'
		} );

		db.close();

		setTimeout(() => {
			log.debug( {
				app: 'main',
				action: 'stop-webserver',
				message: 'Server was forced to shutdown after timeout'
			} );
			process.exit(1);
		}, 20000).unref();

		server.close(() => process.exit());
		internalServer.close();
	});
});

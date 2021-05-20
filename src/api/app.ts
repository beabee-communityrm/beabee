import 'module-alias/register';
import 'reflect-metadata';

import express from 'express';
import { useExpressServer } from 'routing-controllers';

import { SignupController } from './controllers/SignupController';

import * as db from '@core/database';
import { log } from '@core/logging';

const app = express();
useExpressServer(app, {
	routePrefix: '/1.0',
	controllers: [SignupController]
});

db.connect().then(() => {
	const server = app.listen(3000);

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
		//internalServer.close();
	});
});

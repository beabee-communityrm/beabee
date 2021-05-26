import 'module-alias/register';
import 'reflect-metadata';

import express, { Request } from 'express';
import { Action, useExpressServer } from 'routing-controllers';

import { SignupController } from './controllers/SignupController';

import * as db from '@core/database';
import { log } from '@core/logging';
import { parseJWTToken } from '@core/utils/auth';

import MembersService from '@core/services/MembersService';

async function currentUserChecker(action: Action) {
	const auth = (action.request as Request).headers.authorization;
	if (auth?.startsWith('Bearer ')) {
		const memberId = parseJWTToken(auth.slice(8));
		const member = await MembersService.findOne(memberId);
		return member;
	}
}

const app = express();
useExpressServer(app, {
	routePrefix: '/1.0',
	controllers: [SignupController],
	currentUserChecker,
	authorizationChecker: action => !!currentUserChecker(action)
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

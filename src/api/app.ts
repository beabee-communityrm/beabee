import 'module-alias/register';
import 'reflect-metadata';

import cookie from 'cookie-parser';
import express, { Request } from 'express';
import { Action, useExpressServer } from 'routing-controllers';

import { MemberController  } from './controllers/MemberController';
import { SignupController } from './controllers/SignupController';

import * as db from '@core/database';
import { log } from '@core/logging';
import sessions from '@core/sessions';
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
app.use(cookie());

db.connect().then(() => {
	sessions(app);

	useExpressServer(app, {
		routePrefix: '/1.0',
		controllers: [
			MemberController,
			SignupController
		],
		currentUserChecker,
		authorizationChecker: action => !!currentUserChecker(action)
	});

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

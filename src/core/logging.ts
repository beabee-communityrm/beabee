import config from '@config';
import Logger, { Stream } from 'bunyan';

import bunyan, { LogLevelString } from 'bunyan';
import bunyanMiddleware from 'bunyan-middleware';
import BunyanSlack, { BunyanSlackOptions } from 'bunyan-slack';

import crypto from'crypto';
import { Express, NextFunction, Request, Response } from 'express';

const randomKey = crypto.randomBytes(256);

// Bunyan logging
const bunyanConfig = {
	name: 'Membership-System',
	streams: [{
		level: 'debug',
		stream: process.stderr
	}] as Stream[],
	serializers: {
		error: bunyan.stdSerializers.err
	}
};

const logSlack = (config as unknown as {logSlack?: Omit<BunyanSlackOptions,'customFormatter'>}).logSlack;

if (logSlack) {
	const stream = new BunyanSlack( {
		...logSlack,
		customFormatter(record, levelName) {
			const msgPrefix = (config.dev ? '[DEV] ' : '') + `[${levelName.toUpperCase()}] `;

			if (record.error) {
				return {
					text: msgPrefix + record.error.message,
					attachments: [{
						title: 'Stack trace',
						text: record.error.stack
					}]
				};
			} else {
				return {
					text: msgPrefix + record.msg
				};
			}
		}
	} );
	bunyanConfig.streams.push( {
		level: logSlack.level,
		stream
	} );
}

const mainLogger = bunyan.createLogger( bunyanConfig );
const reqLogger = bunyan.createLogger({
	name: 'Membership-System-requests',
	level: 'info',
	stream: process.stdout
});

interface LogParams {
	sensitive?: Record<string, unknown>
	[key: string]: unknown
}

function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
	const log = req.log;

	const logAThing = (level: LogLevelString) => (params: LogParams, msg: string) => {
		params.ip = req.connection.remoteAddress; //TODO: this will only be correct when behind a reverse proxy, if app.set('trust proxy') is enabled!
		if (! params.sensitive ) {
			params.sensitive = {};
		}
		if ( req.user ) {
			params.sensitive._user = {
				uuid: req.user.uuid,
				firstname: req.user.firstname,
				lastname: req.user.lastname,
				email: req.user.email
			};
			params.anon_userid = crypto.createHash('sha1').update(req.user.uuid + randomKey).digest('base64');
		}
		if ( req.sessionID ) {
			params.sensitive.sessionID = req.sessionID;
			params.anon_sessionId = crypto.createHash('sha1').update(req.sessionID + randomKey).digest('base64');
		}
		log[level](params, msg);
		if (params.sensitive) {
			delete params.sensitive;
		}
	};

	req.log = {
		info: logAThing('info'),
		debug: logAThing('debug'),
		error: logAThing('error'),
		fatal: logAThing('fatal')
	} as any; // TODO: Force overwriting value, fix this!

	next();
}

export function installMiddleware(app: Express): void {
	app.use( bunyanMiddleware( {
		logger: reqLogger,
		filter: req => req.url.startsWith('/static') || req.url === '/membership.js'
	} ) );
	app.use( loggingMiddleware );
}

export const log = mainLogger;

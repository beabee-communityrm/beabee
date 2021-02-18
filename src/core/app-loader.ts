import fs from 'fs';
import dot from 'dot';
import express from 'express';
import moment from 'moment';

import config from '@config';

import { log } from '@core/logging';
import templateLocals from '@core/template-locals';
import { AppConfigOverride, AppConfigOverrides, AppConfig } from './utils';

let git = '';
try {
	git = fs.readFileSync( __dirname + '/../revision.txt' ).toString();
} catch (e) {
	git = 'DEV';
}

async function loadAppConfigs(basePath: string, overrides: AppConfigOverrides = {}): Promise<AppConfig[]> {
	const appConfigs = fs.readdirSync(basePath)
		.filter(appDir => {
			const path = basePath + '/' + appDir;
			return fs.statSync(path).isDirectory() && fs.existsSync(path + '/config.json');
		})
		.map(appDir => loadAppConfig(appDir, basePath + '/' + appDir, overrides[appDir]));

	return (await Promise.all(appConfigs))
		.filter(appConfig => !appConfig.disabled)
		.sort((a, b) => b.priority - a.priority);
}

async function loadAppConfig(uid: string, path: string, overrides: AppConfigOverride = {}): Promise<AppConfig> {
	const appConfig = await import(path + '/config.json');

	const subApps = fs.existsSync(path + '/apps') ?
		await loadAppConfigs(path + '/apps', overrides.subApps) : [];

	return {
		uid,
		appPath: path + '/app.js',
		priority: 100,
		menu: 'none',
		permissions: [],
		subApps,
		...appConfig,
		...overrides.config
	};
}

async function requireApp(appPath: string): Promise<express.Express> {
	const app = await import(appPath);
	return app.default || app;
}

async function routeApps(parentApp: express.Express, appConfigs: AppConfig[]) {
	for (const appConfig of appConfigs) {
		log.debug( {
			app: 'app-loader',
			action: 'load-app',
			path: parentApp.mountpath + (parentApp.mountpath === '/' ? '' : '/') + appConfig.path
		} );

		const app = await requireApp(appConfig.appPath);

		// For pug templates
		app.locals.basedir = __dirname + '/..';

		// Global locals
		app.locals.git = git;
		app.locals.audience = config.audience;
		app.locals.currencySymbol = config.currencySymbol;
		app.locals.dev = config.dev;

		// Global libraries
		app.locals.moment = moment;
		app.locals.dot = dot;

		parentApp.use('/' + appConfig.path, (req, res, next) => {
			res.locals.app = appConfig;
			// Bit of a hack to pass all params everywhere
			req.allParams = {...req.allParams, ...req.params};
			next();
		}, app);

		if (appConfig.subApps.length > 0) {
			await routeApps(app, appConfig.subApps);
		}
	}
}

export default async function(app: express.Express): Promise<void> {
	const appConfigs = await loadAppConfigs(
		__dirname + '/../apps',
		(config as any).appOverrides
	);
	app.use(templateLocals(appConfigs));
	await routeApps(app, appConfigs);
}

import fs from 'fs';
import express from 'express';

import config from '@config';

import { log } from '@core/logging';
import templateLocals from '@core/template-locals';
import { AppConfigOverride, AppConfigOverrides, FullAppConfig } from './utils';

async function loadAppConfigs(basePath: string, overrides: AppConfigOverrides = {}): Promise<FullAppConfig[]> {
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

async function loadAppConfig(uid: string, path: string, overrides: AppConfigOverride = {}): Promise<FullAppConfig> {
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

async function requireApp(appPath: string): Promise<(app: FullAppConfig) => express.Express> {
	const app = await import(appPath);
	return app.default || app;
}

async function routeApps(parentApp: express.Express, appConfigs: FullAppConfig[]) {
	for (const appConfig of appConfigs) {
		log.debug( {
			app: 'app-loader',
			action: 'load-app',
			path: parentApp.mountpath + (parentApp.mountpath === '/' ? '' : '/') + appConfig.path
		} );

		const app = (await requireApp(appConfig.appPath))(appConfig);
		app.locals.basedir = __dirname + '/..';
		parentApp.use('/' + appConfig.path, (req, res, next) => {
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

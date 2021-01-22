import fs from 'fs';
import moment from 'moment';
import dot from 'dot';

import config from '@config';
import { NextFunction, Request, Response } from 'express';
import { FullAppConfig } from './utils';

let git = '';
try {
	git = fs.readFileSync( __dirname + '/../revision.txt' ).toString();
} catch (e) {
	git = 'DEV';
}

function hasPermission(perms1: string[], perms2: string[]) {
	return perms1.filter(p => perms2.includes(p)).length > 0;
}

export default (appConfigs: FullAppConfig[]) => (req: Request, res: Response, next: NextFunction): void => {
	// Process which apps should be shown in menu
	res.locals.currentUrl = req.originalUrl;
	res.locals.menu = {
		main: []
	};

	const userPermissions = req.user ? req.user.quickPermissions : ['loggedOut'];

	for (const appConfig of appConfigs) {
		if (appConfig.menu !== 'none' && hasPermission(userPermissions, appConfig.permissions)) {
			res.locals.menu[appConfig.menu].push({
				title: appConfig.title,
				path: appConfig.path,
				hidden: appConfig.hidden,
				active: req.url.startsWith('/' + appConfig.path),
				subMenu: appConfig.subApps
					.filter(subAppConfig => (
						!subAppConfig.hidden && hasPermission(userPermissions, subAppConfig.permissions)
					)).map(subAppConfig => ({
						title: subAppConfig.title,
						path: subAppConfig.path,
						hidden: subAppConfig.hidden
					}))
			});
		}
	}

	// Define some locals
	res.locals.isLoggedIn = !!req.user;
	res.locals.git = git;
	res.locals.dev = config.dev;

	// Add some libraries
	res.locals.moment = moment;
	res.locals.dot = dot;

	// Template permissions
	res.locals.access = function( permission: string ) {
		if ( !req.user ) return false;
		if ( req.user.quickPermissions.indexOf( config.permission.superadmin ) != -1 ) return true;
		if ( permission == 'member' ) permission = config.permission.member;
		if ( permission == 'admin' ) permission = config.permission.admin;
		if ( permission == 'superadmin' ) permission = config.permission.superadmin;
		if ( permission == 'access' ) permission = config.permission.access;

		return ( req.user.quickPermissions.indexOf( permission ) != -1 ? true : false );
	};

	// Prepare a CSRF token if available
	if ( req.csrfToken ) res.locals.csrf = req.csrfToken();

	// Load config + prepare breadcrumbs
	res.locals.config = {};
	res.locals.config.permission = config.permission;
	res.locals.breadcrumb = [];

	next();
};

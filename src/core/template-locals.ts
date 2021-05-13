import { PermissionType } from '@models/MemberPermission';
import { NextFunction, Request, Response } from 'express';

export interface AppConfig {
	uid: string
	title: string
	path: string
	disabled: boolean
	priority: number
	appPath: string
	apiPath?: string
	hidden?: boolean
	subApps: AppConfig[]
	menu: 'none'|'main'
	permissions: string[]
}

function hasPermission(perms1: string[], perms2: string[]) {
	return perms1.filter(p => perms2.includes(p)).length > 0;
}

export default (appConfigs: AppConfig[]) => (req: Request, res: Response, next: NextFunction): void => {
	// Process which apps should be shown in menu
	res.locals.menu = {
		main: []
	};

	const userPermissions = req.user ? ['loggedIn', ...req.user.quickPermissions] : ['loggedOut'];

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

	// Permissions
	res.locals.isLoggedIn = !!req.user;
	res.locals.access = function( permission: PermissionType ) {
		if ( !req.user ) return false;
		return req.user.quickPermissions.indexOf('superadmin') > -1 ||
			req.user.quickPermissions.indexOf(permission) > -1;
	};

	// Prepare a CSRF token if available
	if ( req.csrfToken ) res.locals.csrf = req.csrfToken();

	// Load config + prepare breadcrumbs
	res.locals.config = {};
	res.locals.breadcrumb = [];

	next();
};

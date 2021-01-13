const moment = require( 'moment' );
const dot = require('dot');

const auth = require( '@core/authentication' );

const config = require( '@config' );

var apps = [];

var git = '';
try {
	git = require('fs').readFileSync( __dirname + '/../revision.txt' ).toString();
} catch (e) {
	git = 'DEV-' + Math.random();
}

function templateLocals( req, res, next ) {
	// Process which apps should be shown in menu

	res.locals.currentUrl = req.originalUrl;
	res.locals.apps = {
		main: [],
		secondary: []
	};
	res.locals.subapps = {};

	for ( var a in apps ) {
		var app = apps[a];
		if ( app.menu != 'none' ) {
			if ( app.permissions && app.permissions != [] ) {
				if ( req.user ) {
					for ( let p in app.permissions ) {
						if ( auth.checkPermission( req, app.permissions[p] ) ) {
							res.locals.apps[ app.menu ].push( app );
							break;
						}
					}
				} else {
					if ( app.permissions.indexOf( 'loggedOut' ) != -1 )
						res.locals.apps[ app.menu ].push( app );
				}
				res.locals.subapps[ app.uid ] = [];
			}
			if ( app.subapps.length > 0 ) {
				for ( let s in app.subapps ) {
					var subapp = app.subapps[s];
					if ( subapp.hidden !== true ) {
						if ( subapp.permissions && subapp.permissions != [] ) {
							if ( req.user ) {
								for ( let p in subapp.permissions ) {
									if ( auth.checkPermission( req, subapp.permissions[p] ) ) {
										res.locals.subapps[ app.uid ].push( subapp );
										break;
									}
								}
							}
						} else if ( req.user ) {
							res.locals.subapps[ app.uid ].push( subapp );
						}
					}
				}
			}
		}
	}

	// Template permissions
	res.locals.access = function( permission ) {
		if ( !req.user ) return false;
		if ( req.user.quickPermissions.indexOf( config.permission.superadmin ) != -1 ) return true;
		if ( permission == 'member' ) permission = config.permission.member;
		if ( permission == 'admin' ) permission = config.permission.admin;
		if ( permission == 'superadmin' ) permission = config.permission.superadmin;
		if ( permission == 'access' ) permission = config.permission.access;

		return ( req.user.quickPermissions.indexOf( permission ) != -1 ? true : false );
	};

	var admin_permissions = [];
	if ( req.user ) {
		for ( var p in req.user.permissions ) {
			var perm = req.user.permissions[p];
			if ( perm.admin ) admin_permissions.push( perm.permission.slug );
		}
	}
	res.locals.can_admin = function( permission ) {
		if ( res.locals.access( 'superadmin' ) ) return true;
		return admin_permissions.indexOf( permission ) != -1;
	};

	res.locals.isLoggedIn = !!req.user;

	// Prepare a CSRF token if available
	if ( req.csrfToken ) res.locals.csrf = req.csrfToken();

	// Load config + prepare breadcrumbs
	res.locals.config = {};
	res.locals.config.permission = config.permission;
	res.locals.breadcrumb = [];
	res.locals.git = git;
	if ( config.dev ) res.locals.dev = true;

	// Moment.js
	res.locals.moment = moment;
	res.locals.dot = dot;

	next();
}

module.exports = function( a ) {
	apps = a;
	return templateLocals;
};

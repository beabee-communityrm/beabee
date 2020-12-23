var config = require( '@config' );

var log = require( '@core/logging' ).log;

var fs = require( 'fs' );

module.exports = function( app ) {
	// Loop through main app directory contents
	var apps = loadApps( __dirname + '/../apps', config.appOverrides );

	// Load template locals;
	app.use( require( '@core/template-locals' )( apps ) );

	// Route apps
	routeApps(app, apps);
};

function loadApps( basePath, overrides ) {
	return fs.readdirSync( basePath )
		.filter( function ( file ) {
			var path = basePath + '/' + file;
			return fs.statSync( path ).isDirectory() && fs.existsSync( path + '/config.json' );
		} )
		.map( function ( file ) {
			return loadApp( file, basePath + '/' + file, overrides[file] );
		} )
		.filter( function ( app ) {
			return ! app.disabled;
		} )
		.sort( function ( a, b ) {
			return b.priority - a.priority;
		} );
}

function loadApp( uid, path, overrides ) {
	var appConfig = require( path + '/config.json' );
	overrides = overrides || { config: {}, subapps: {} };

	var subapps = fs.existsSync( path + '/apps' ) ?
		loadApps( path + '/apps', overrides.subapps ) : [];

	return {
		uid,
		app: path + '/app.js',
		priority: 100,
		subapps,
		...appConfig,
		...overrides.config
	};
}

// TODO: temporary during TypeScript switch over
function requireApp( app ) {
	const m = require(app);
	return m.default || m;
}

function routeApps(mainApp, apps) {
	for ( var a in apps ) {
		var _app = apps[a];
		log.debug( {
			app: 'app-loader',
			action: 'load-app',
			path: '/' + _app.path
		} );
		var new_app = requireApp( _app.app )( _app );
		new_app.locals.basedir = __dirname + '/..';
		mainApp.use( '/' + _app.path, new_app );

		if ( _app.subapps.length > 0 ) {
			for ( var s in _app.subapps ) {
				var _sapp = _app.subapps[s];
				log.debug( {
					app: 'app-loader',
					action: 'load-app',
					path: '/' + _app.path + '/' + _sapp.path
				} );

				var new_sub_app = requireApp( _sapp.app )( _sapp );
				new_sub_app.locals.basedir = __dirname + '/..';
				new_app.use( '/' + _sapp.path, new_sub_app );
			}
		}
	}
}

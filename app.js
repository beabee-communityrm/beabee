global.__root = __dirname;
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

var log = require( __js + '/logging' ).log;
log.info( {
	app: 'main',
	action: 'start'
} );

var config = require( __config );

if ( !config.gocardless.sandbox && config.dev ){
	log.error({
		app: 'main',
		error: 'Dev mode enabled but GoCardless is not in sandbox, refusing to start'
	});
	process.exit(1);
}

var database = require( __js + '/database' ).connect( config.mongo );

var express = require( 'express' ),
	helmet = require( 'helmet' ),
	flash = require( 'express-flash' ),
	app = express(),
	http = require( 'http' ).Server( app );

var Options = require( __js + '/options' )();
app.use( Options.load );

var app_loader = require( __js + '/app-loader' );

// Add logging capabilities
require( __js + '/logging' ).installMiddleware( app );

// Use helmet
app.use( helmet() );

// Handle authentication
require( __js + '/authentication' ).auth( app );

// Setup static route (only used on dev)
app.use( '/static', express.static( __root + '/static' ) );

// Handle sessions
require( __js + '/sessions' )( app );

// Include support for notifications
app.use( flash() );
app.use( require( __js + '/quickflash' ) );

// Use PUG to render pages
app.set( 'views', __root + '/src/views' );
app.set( 'view engine', 'pug' );
app.set( 'view cache', false );

// Load apps
app_loader( app );

// Setup tracker
app.use( '/membership.js', express.static( __root + '/src/membership.js' ) );

// Error 404
app.use( function ( req, res, next ) { // eslint-disable-line no-unused-vars
	res.status( 404 );
	res.render( '404' );
} );

// Error 500
app.use( function ( err, req, res, next ) { // eslint-disable-line no-unused-vars
	res.status( 500 );
	res.render( '500', { error: ( config.dev ? err.stack : undefined ) } );
	req.log.error({
		error: err
	});
} );

// Start server
var server = app.listen( config.port ,config.host, function () {
	log.debug( {
		app: 'main',
		action: 'start-webserver',
		message: 'Started',
		address: server.address()
	} );
} );

process.on('SIGTERM', () => {
	log.debug( {
		app: 'main',
		action: 'stop-webserver',
		message: 'Waiting for server to shutdown'
	} );

	setTimeout(() => {
		log.debug( {
			app: 'main',
			action: 'stop-webserver',
			message: 'Server was forced to shutdown after timeout'
		} );
		process.exit(1);
	}, 20000).unref();

	server.close(() => {
		log.debug( {
			app: 'main',
			action: 'stop-webserver',
			message: 'Server successfully shutdown'
		} );
		process.exit();
	});
});

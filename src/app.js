require('module-alias/register');
require('reflect-metadata');

const express = require( 'express' );
const helmet = require( 'helmet' );
const flash = require( 'express-flash' );

const appLoader = require( '@core/app-loader' );
const auth = require( '@core/authentication' );
const database = require( '@core/database' );
const { log, installMiddleware: installLogMiddleware } = require( '@core/logging' );
const { default: quickflash } = require( '@core/quickflash' );
const sessions = require( '@core/sessions' );

const { default: OptionsService } = require('@core/services/OptionsService');
const { default: PageSettingsService } = require('@core/services/PageSettingsService');

const specialUrlHandler = require( '@apps/tools/apps/special-urls/handler' );

const config = require( '@config' );

if ( !config.gocardless.sandbox && config.dev ) {
	log.error({
		app: 'main',
		error: 'Dev mode enabled but GoCardless is not in sandbox, refusing to start'
	});
	process.exit(1);
}

log.info( {
	app: 'main',
	action: 'start'
} );

const app = express();

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'pug' );
app.set( 'view cache', false );

// Setup static route (only used on dev)
app.use( '/static', express.static( __dirname + '/static' ) );

// Add logging capabilities
installLogMiddleware( app );

// Use helmet
app.use( helmet( { contentSecurityPolicy: false } ) );

database.connect( config.mongo, config.db ).then(() => {
	// Load some caches
	OptionsService.reload();
	PageSettingsService.reload();

	// Load options
	app.use( OptionsService.middleware.bind(OptionsService) );

	// Handle authentication
	auth.load( app );

	// Handle sessions
	sessions( app );

	// Include support for notifications
	app.use( flash() );
	app.use( quickflash );

	// Setup tracker
	app.use( '/membership.js', (req, res) => {
		const referrerUrl = req.get('referer');
		res.set('Content-Type', 'application/javascript');
		if (!referrerUrl || config.trackDomains.some(domain => referrerUrl.startsWith(domain))) {
			const memberId = req.cookies.memberId;
			if (memberId) {
				res.send('window.Membership = {memberId: "' + memberId + '"}');
			} else {
				res.send('window.Membership = {}');
			}
		} else {
			res.status(404).send('');
		}
	});

	// Include page settings
	app.use( PageSettingsService.middleware.bind(PageSettingsService) );

	// Load apps
	appLoader( app );

	// Hook to handle special URLs
	app.use( '/s', specialUrlHandler );

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

		database.close();

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
});

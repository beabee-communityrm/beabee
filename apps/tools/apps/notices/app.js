const express = require( 'express' );

const auth = require( __js + '/authentication' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	res.locals.activeApp = 'notices';
	next();
} );


module.exports = function( config ) {
	app_config = config;
	return app;
};

var	express = require( 'express' ),
	app = express();

var auth = require( '@core/authentication' ),
	db = require( '@core/database' ),
	Payments = db.Payments;

var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.parent.mountpath + app.mountpath
	} );
	next();
} );

app.get( '/', auth.isMember, function( req, res ) {
	Payments.find( { member: req.user._id }, function( err, payments ) {
		res.render( 'index', { payments: payments.reverse() } );
	} );
} );

module.exports = function( config ) {
	app_config = config;
	return app;
};

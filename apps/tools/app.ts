import express from 'express';

const app = express();
let app_config;

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title
	} );
	next();
} );

export default function( config ): express.Express {
	app_config = config;
	return app;
}

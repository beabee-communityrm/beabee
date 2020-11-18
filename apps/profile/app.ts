import express from 'express';

import { isLoggedIn } from '@core/authentication';
import { Notices } from '@core/database';
import { wrapAsync } from '@core/utils';

const app = express();
let app_config;

app.set( 'views', __dirname + '/views' );

app.use( isLoggedIn );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await Notices.find( { enabled: true } ); // TODO: filter for expires
	res.render( 'index', { user: req.user, notices } );
} ) );

export default function( config ): express.Express {
	app_config = config;
	return app;
}

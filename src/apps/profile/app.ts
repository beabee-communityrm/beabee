import express from 'express';
import { getCustomRepository } from 'typeorm';

import auth from '@core/authentication';
import { AppConfig, wrapAsync } from '@core/utils';
import NoticeRespository from '@core/repositories/NoticeRepository';

const app = express();
let app_config: AppConfig;

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await getCustomRepository(NoticeRespository).findActive();
	res.render( 'index', { user: req.user, notices } );
} ) );

export default function( config: AppConfig ): express.Express {
	app_config = config;
	return app;
}

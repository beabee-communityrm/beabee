import express from 'express';
import { getCustomRepository } from 'typeorm';

import auth from '@core/authentication';
import { wrapAsync } from '@core/utils';
import NoticeRespository from '@core/repositories/NoticeRepository';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await getCustomRepository(NoticeRespository).findActive();
	res.render( 'index', { user: req.user, notices } );
} ) );

export default app;

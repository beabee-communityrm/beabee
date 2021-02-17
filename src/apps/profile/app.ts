import express from 'express';

import auth from '@core/authentication';
import { wrapAsync } from '@core/utils';
import NoticeService from '@core/services/NoticeService';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await NoticeService.findActive();
	res.render( 'index', { user: req.user, notices } );
} ) );

export default app;

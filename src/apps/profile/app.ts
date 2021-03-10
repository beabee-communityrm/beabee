import express from 'express';
import { getRepository } from 'typeorm';

import { isLoggedIn } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import NoticeService from '@core/services/NoticeService';

import MemberProfile from '@models/MemberProfile';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( isLoggedIn );

app.use(wrapAsync(async (req, res, next) => {
	req.user!.profile = await getRepository(MemberProfile).findOne(req.user!.id);
	next();
}));

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await NoticeService.findActive();
	res.render( 'index', { user: req.user, notices } );
} ) );

export default app;

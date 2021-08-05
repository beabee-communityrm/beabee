import express from 'express';
import { getRepository } from 'typeorm';

import { isLoggedIn } from '@core/middleware';
import { wrapAsync } from '@core/utils';
import { AuthenticationStatus, canAdmin } from '@core/utils/auth';

import NoticeService from '@core/services/NoticeService';
import OptionsService from '@core/services/OptionsService';

import MemberProfile from '@models/MemberProfile';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( isLoggedIn );

// TODO: Temporary way to stop non-admins seeing the dashboard
app.use((req, res, next) => {
	const redirectUrl = OptionsService.getText('user-redirect-url');
	if (redirectUrl && canAdmin(req) !== AuthenticationStatus.LOGGED_IN) {
		res.redirect(redirectUrl);
	} else {
		next();
	}
});

app.use(wrapAsync(async (req, res, next) => {
	const profile = await getRepository(MemberProfile).findOne(req.user!.id);
	req.user!.profile = profile!;
	next();
}));

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await NoticeService.findActive();
	res.render( 'index', { user: req.user, notices } );
} ) );

export default app;

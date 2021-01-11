import express, { NextFunction, Request, Response } from 'express';

import auth from '@core/authentication';
import { hasNewModel, hasSchema } from '@core/middleware';
import { AppConfig, hasUser, wrapAsync } from '@core/utils';

import ReferralsService from '@core/services/ReferralsService';

import { chooseGiftSchema } from './schema.json';
import Referral from '@models/Referral';
import { Members } from '@core/database';

interface ChooseGiftSchema {
	referralGift?: string;
	referralGiftOptions?: Record<string, string>;
}

const app = express();
let app_config: AppConfig;

function hasOwnReferral(req: Request, res: Response, next: NextFunction) {
	hasNewModel(Referral, 'id')(req, res, () => {
		const referral = req.body as Referral;
		if (referral.referrerId === req.user?.id) {
			next();
		} else {
			next('route');
		}
	});
}

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/', wrapAsync( hasUser( async ( req, res ) => {
	const referrals = await ReferralsService.getMemberReferrals(req.user);
	res.render( 'index', { referralLink: req.user.referralLink, referrals } );
} ) ) );

app.get( '/:id', hasOwnReferral, wrapAsync( async ( req, res ) => {
	const referral = req.model as Referral;
	const referee = await Members.findOne({ _id: referral.refereeId });
	const gifts = await ReferralsService.getGifts();
	res.render( 'referral', { referral, referee, gifts } );
} ) );

app.post( '/:id', [
	hasOwnReferral, hasSchema(chooseGiftSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const referral = req.body as Referral;
	const giftParams = req.body as ChooseGiftSchema;

	if (await ReferralsService.setReferrerGift(referral, giftParams)) {
		req.flash( 'success', 'referral-gift-chosen' );
		res.redirect( '/profile/referrals' );
	} else {
		req.flash( 'warning', 'referral-gift-invalid' );
		res.redirect( req.originalUrl );
	}
} ) );

export default function( config: AppConfig ): express.Express {
	app_config = config;
	return app;
}

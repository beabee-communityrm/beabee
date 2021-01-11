import express from 'express';

import auth from '@core/authentication';
import { Referrals } from '@core/database';
import { hasSchema } from '@core/middleware';
import { AppConfig, hasUser, wrapAsync } from '@core/utils';

import ReferralsService from '@core/services/ReferralsService';

import { chooseGiftSchema } from './schema.json';

interface ChooseGiftSchema {
	referralGift?: string;
	referralGiftOptions?: Record<string, string>;
}

const app = express();
let app_config: AppConfig;

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/', wrapAsync( hasUser( async ( req, res ) => {
	const referrals = await Referrals.find({ referrer: req.user }).populate('referee') as any[];
	const gifts = await ReferralsService.getGifts();

	for (const referral of referrals) {
		referral.referrerGiftDetails = gifts.find(gift => gift.name === referral.referrerGift);
	}

	res.render( 'index', { referralLink: req.user.referralLink, referrals } );
} ) ) );

app.get( '/:id', wrapAsync( async ( req, res ) => {
	const referral = await Referrals.findOne({ _id: req.params.id, referrer: req.user }).populate('referee');
	const gifts = await ReferralsService.getGifts();
	res.render( 'referral', { referral, gifts } );
} ) );

app.post( '/:id', hasSchema(chooseGiftSchema).orFlash, wrapAsync( async ( req, res ) => {
	const referral = await Referrals.findOne({ _id: req.params.id, referrer: req.user }).populate('referee') as any;
	const giftParams = req.body as ChooseGiftSchema;

	if (referral.referrerGift === undefined && await ReferralsService.isGiftAvailable(giftParams, referral.refereeAmount)) {
		await Referrals.updateOne({
			_id: req.params.id,
			referrer: req.user
		}, {$set: {
			referrerGift: giftParams.referralGift || '',
			referrerGiftOptions: giftParams.referralGiftOptions
		}});

		await ReferralsService.updateGiftStock(giftParams);

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

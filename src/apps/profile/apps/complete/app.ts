import express from 'express';

import auth from '@core/authentication';
import { hasSchema } from '@core/middleware';
import { hasUser, wrapAsync } from '@core/utils';

import { completeSchema } from './schemas.json';
import Referral from '@models/Referral';
import { getRepository } from 'typeorm';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	if ( req.user?.setupComplete ) {
		res.redirect( '/profile' );
	} else {
		next();
	}
} );

app.use(auth.isLoggedIn);

app.get( '/', wrapAsync( async function( req, res ) {
	const referral = await getRepository(Referral).findOne({refereeId: req.user?.id});

	const isGift = req.user?.contributionPeriod === 'gift';
	const isReferralWithGift = referral && referral.refereeGift;

	res.render( 'complete', { user: req.user, isReferralWithGift, isGift } );
} ) );

app.post( '/', hasSchema(completeSchema).orFlash, wrapAsync( hasUser(async function( req, res ) {
	const {
		body: {
			password, delivery_optin, delivery_line1, delivery_line2,
			delivery_city, delivery_postcode, reason, reason_more, how, known,
			more,  shareable
		},
		user
	} = req;

	const referral = await getRepository(Referral).findOne({refereeId: user.id});

	const needAddress = delivery_optin || referral && referral.refereeGift ||
		user.contributionPeriod === 'gift';
	const gotAddress = delivery_line1 && delivery_city && delivery_postcode;

	if (needAddress && !gotAddress) {
		req.flash( 'error', 'address-required' );
		res.redirect( req.originalUrl );
	} else {
		const hashedPassword = await auth.generatePasswordPromise( password );
		await user.update( { $set: {
			password: hashedPassword,
			delivery_optin,
			delivery_address: needAddress ? {
				line1: delivery_line1,
				line2: delivery_line2,
				city: delivery_city,
				postcode: delivery_postcode
			} : {},
			join_reason: reason,
			join_reason_more: reason_more,
			join_how: how,
			join_known: known,
			join_more: more,
			join_shareable: !!shareable,
		} } );

		res.redirect( '/profile' );
	}
} ) ) );

export default app;

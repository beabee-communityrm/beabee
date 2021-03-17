import express from 'express';
import { getRepository } from 'typeorm';

import { hasSchema, isLoggedIn } from '@core/middleware';
import { ContributionType, hasUser, wrapAsync } from '@core/utils';
import { generatePassword } from '@core/utils/auth';

import MembersService from '@core/services/MembersService';
import OptionsService from '@core/services/OptionsService';
import PollsService from '@core/services/PollsService';

import Referral from '@models/Referral';

import { completeSchema } from './schemas.json';

async function getJoinPoll() {
	const joinPollId = OptionsService.getText('join-poll');
	return joinPollId ? await PollsService.getPoll(joinPollId) : undefined;
}

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	if ( req.user?.setupComplete ) {
		res.redirect( '/profile' );
	} else {
		next();
	}
} );

app.use(isLoggedIn);

app.get( '/', wrapAsync( async function( req, res ) {
	const referral = await getRepository(Referral).findOne({referee: req.user});

	res.render( 'complete', {
		user: req.user,
		isReferralWithGift: referral && referral.refereeGift,
		isGift: req.user?.contributionType === ContributionType.Gift,
		joinPoll: await getJoinPoll()
	} );
} ) );

app.post( '/', hasSchema(completeSchema).orFlash, wrapAsync( hasUser(async function( req, res ) {
	const {
		body: {
			password, delivery_optin, delivery_line1, delivery_line2,
			delivery_city, delivery_postcode
		},
		user
	} = req;

	const referral = await getRepository(Referral).findOne({referee: user});

	const joinPoll = await getJoinPoll();
	if (joinPoll && req.body.data) {
		await PollsService.setResponse(joinPoll, user, req.body.data);
	}

	const needAddress = delivery_optin || referral && referral.refereeGift ||
		user.contributionType === ContributionType.Gift;
	const gotAddress = delivery_line1 && delivery_city && delivery_postcode;

	if (needAddress && !gotAddress) {
		req.flash( 'error', 'address-required' );
		res.redirect( req.originalUrl );
	} else {
		await MembersService.updateMember(user, {
			password: await generatePassword(password)
		});
		await MembersService.updateMemberProfile(user, {
			deliveryOptIn: delivery_optin,
			deliveryAddress: needAddress ? {
				line1: delivery_line1,
				line2: delivery_line2,
				city: delivery_city,
				postcode: delivery_postcode
			} : undefined
		});

		res.redirect( '/profile' );
	}
} ) ) );

export default app;

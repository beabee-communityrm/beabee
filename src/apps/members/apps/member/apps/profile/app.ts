import express from 'express';

import { hasSchema } from '@core/middleware';
import { cleanEmailAddress, isDuplicateIndex, wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';

import Member from '@models/Member';

import { updateProfileSchema } from './schemas.json';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', ( req, res ) => {
	res.render( 'index', { member: req.model } );
} );

app.post( '/', [
	hasSchema(updateProfileSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const {
		body: {
			email, firstname, lastname, delivery_optin, delivery_line1,
			delivery_line2, delivery_city, delivery_postcode
		}
	} = req;
	const member = req.model as Member;

	const cleanedEmail = cleanEmailAddress(email);

	try {
		await MembersService.updateMember(member, {
			email: cleanedEmail,
			firstname,
			lastname
		});
		await MembersService.updateMemberProfile(member, {
			deliveryOptIn: delivery_optin,
			deliveryAddress: delivery_optin ? {
				line1: delivery_line1,
				line2: delivery_line2,
				city: delivery_city,
				postcode: delivery_postcode
			} : undefined
		});
	} catch (error) {
		if (isDuplicateIndex(error, 'email')) {
			req.flash( 'danger', 'email-duplicate' );
		} else {
			throw error;
		}
	}

	res.redirect(req.originalUrl);
} ) );

export default app;

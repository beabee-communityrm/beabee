import express from 'express';

import { hasSchema } from '@core/middleware';
import { cleanEmailAddress, wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';

import { updateProfileSchema } from './schemas.json';
import { Member } from '@models/members';

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

	const cleanedEmail = cleanEmailAddress(email);

	try {
		await MembersService.updateMember(req.model as Member, {
			email: cleanedEmail,
			firstname,
			lastname,
			delivery_optin,
			delivery_address: delivery_optin ? {
				line1: delivery_line1,
				line2: delivery_line2,
				city: delivery_city,
				postcode: delivery_postcode
			} : {}
		});
	} catch ( saveError ) {
		// Duplicate key (on email)
		if ( saveError.code === 11000 ) {
			req.flash( 'danger', 'email-duplicate' );
		} else {
			throw saveError;
		}
	}

	res.redirect(req.originalUrl);
} ) );

export default app;

import	express from 'express';

import auth from '@core/authentication';
import { hasSchema } from '@core/middleware';
import { hasUser, wrapAsync } from '@core/utils';

import { updateSchema } from './schemas.json';
import MembersService from '@core/services/MembersService';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', auth.isLoggedIn, function( req, res ) {
	res.render( 'index', { user: req.user } );
} );

app.post( '/', [
	auth.isLoggedIn,
	hasSchema(updateSchema).orFlash
], wrapAsync( hasUser(async function( req, res ) {
	const { body: { delivery_optin, delivery_line1, delivery_line2, delivery_city,
		delivery_postcode } } = req;

	await MembersService.updateMember(req.user, {
		delivery_optin,
		delivery_address: delivery_optin ? {
			line1: delivery_line1,
			line2: delivery_line2,
			city: delivery_city,
			postcode: delivery_postcode
		} : {}
	});


	req.log.info( {
		app: 'profile',
		action: 'update',
	} );

	req.flash( 'success', 'delivery-updated' );
	res.redirect('/profile/delivery');
} ) ) );

export default app;

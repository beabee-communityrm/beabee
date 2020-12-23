import	express from 'express';

import auth from '@core/authentication';
import { hasSchema } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import { updateSchema } from './schemas.json';
import MembersService from '@core/services/MembersService';

const app = express();
let app_config;

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/', auth.isLoggedIn, function( req, res ) {
	res.render( 'index', { user: req.user } );
} );

app.post( '/', [
	auth.isLoggedIn,
	hasSchema(updateSchema).orFlash
], wrapAsync( async function( req, res ) {
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
} ) );

export default function ( config ): express.Express {
	app_config = config;
	return app;
}

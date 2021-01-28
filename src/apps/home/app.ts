import express from 'express';

import auth from '@core/authentication';
import OptionsService from '@core/services/OptionsService';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', function ( req, res ) {
	if ( auth.loggedIn( req ) == auth.LOGGED_IN ) {
		// Go to first app in menu
		res.redirect( res.locals.menu.main[0].path );
	} else {
		const redirectUrl = OptionsService.getText('home-redirect-url');
		if (redirectUrl) {
			res.redirect(redirectUrl);
		} else {
			res.render( 'index' );
		}
	}
} );

export default app;

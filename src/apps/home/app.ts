import express from 'express';

import auth from '@core/authentication';
import OptionsService from '@core/services/OptionsService';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', auth.isNotLoggedIn, function ( req, res ) {
	const redirectUrl = OptionsService.getText('home-redirect-url');
	if (redirectUrl) {
		res.redirect(redirectUrl);
	} else {
		res.render( 'index' );
	}
} );

export default app;

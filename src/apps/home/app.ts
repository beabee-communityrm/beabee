import express from 'express';

import OptionsService from '@core/services/OptionsService';
import { isNotLoggedIn } from '@core/middleware';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', isNotLoggedIn, function ( req, res ) {
	const redirectUrl = OptionsService.getText('home-redirect-url');
	if (redirectUrl) {
		res.redirect(redirectUrl);
	} else {
		res.render( 'index' );
	}
} );

export default app;

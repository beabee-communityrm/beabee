import express from 'express';

import auth from '@core/authentication';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', function ( req, res ) {
	if ( auth.loggedIn( req ) == auth.LOGGED_IN ) {
		// Go to first app in menu
		res.redirect( res.locals.menu.main[0].path );
	} else {
		res.render( 'index' );
	}
} );

export default app;

import express from 'express';

import { loggedIn, LOGGED_IN } from '@core/authentication';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', function ( req, res ) {
	if ( loggedIn( req ) == LOGGED_IN ) {
		res.redirect( '/profile' );
	} else {
		res.render( 'index' );
	}
} );

export default function(): express.Express { return app; }

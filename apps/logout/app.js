const express = require( 'express' );

const app = express();

app.get( '/' , function( req, res ) {
	delete req.session.method;
	req.logout();
	req.flash( 'success', 'logged-out' );
	res.redirect( '/' );
} );

module.exports = function() { return app; };

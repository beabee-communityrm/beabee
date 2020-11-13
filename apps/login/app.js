const express = require( 'express' );
const passport = require( 'passport' );

const { Members } = require( '@core/database' );
const { isValidNextUrl, getNextParam, loginAndRedirect, wrapAsync } = require ( '@core/utils' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/' , function( req, res ) {
	if ( req.user ) {
		res.redirect( isValidNextUrl( req.query.next ) ? req.query.next : '/profile' );
	} else {
		res.render( 'index', { nextParam: getNextParam( req.query.next ) } );
	}
} );

app.get( '/:code', wrapAsync( async function( req, res ) {
	const member = await Members.findOne( {
		'loginOverride.code': req.params.code,
		'loginOverride.expires': {$gt: new Date()}
	} );

	if (member) {
		await member.update({$unset: {loginOverride: 1}});

		loginAndRedirect(req, res, member);
	} else {
		req.flash('error', 'login-code-invalid');
		res.redirect( '/login' );
	}
} ) );

app.post( '/', (req, res) => {
	passport.authenticate( 'local', {
		failureRedirect: '/login' + getNextParam( req.query.next ),
		failureFlash: true
	} )( req, res, async () => {
		req.session.method = 'plain';
		res.redirect( isValidNextUrl( req.query.next ) ? req.query.next : '/profile' );
	} );
} );

module.exports = function( config ) {
	app_config = config;
	return app;
};

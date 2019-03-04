const express = require( 'express' );
const passport = require( 'passport' );

const { Members } = require( __js + '/database' );
const { isValidNextUrl, getNextParam, wrapAsync } = require ( __js + '/utils' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.activeApp = app_config.uid;
	next();
} );

app.get( '/' , function( req, res ) {
	if ( req.user ) {
		req.flash( 'warning', 'already-logged-in' );
		res.redirect( '/profile' );
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

		req.login(member, function ( loginError ) {
			if ( loginError ) {
				throw loginError;
			}
			res.redirect('/profile');
		});
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

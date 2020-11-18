var	express = require( 'express' ),
	app = express();

var	Members = require( '@core/database' ).Members;

const { cleanEmailAddress, loginAndRedirect, wrapAsync } = require( '@core/utils' );
const { hasSchema } = require( '@core/middleware' );
const mandrill = require( '@core/mandrill' );
const Options = require( '@core/options' )();

const { getResetCodeSchema, resetPasswordSchema } = require( './schemas.json');

var auth = require( '@core/authentication' );

var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( auth.isNotLoggedIn );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/' , function( req, res ) {
	res.render( 'index' );
} );

app.post( '/', hasSchema(getResetCodeSchema).orFlash, wrapAsync( async function( req, res ) {
	const { body: { email } } = req;

	const member = await Members.findOne( { email: cleanEmailAddress(email) } );

	if (member) {
		const code = auth.generateCode();
		member.password.reset_code = code;
		await member.save();

		await mandrill.sendToMember('reset-password', member);
	}

	Options.get( 'flash-password-reset', message => {
		req.flash( 'info', message.value.replace( '%', email ) );
		res.redirect( app.mountpath );
	} );
} ) );

app.get( '/code', function( req, res ) {
	res.render( 'change-password' );
} );

app.get( '/code/:password_reset_code', function( req, res ) {
	res.render( 'change-password', { password_reset_code: req.params.password_reset_code } );
} );

app.post( '/code/:password_reset_code?', hasSchema(resetPasswordSchema).orFlash, wrapAsync( async function( req, res ) {
	const member = await Members.findOne( { 'password.reset_code': req.body.password_reset_code } );
	if (member) {
		const password = await auth.generatePasswordPromise( req.body.password );

		await member.update( { $set: {
			'password.salt': password.salt,
			'password.hash': password.hash,
			'password.reset_code': null,
			'password.tries': 0,
			'password.iterations': password.iterations
		} } );

		req.flash( 'success', 'password-changed' );

		loginAndRedirect( req, res, member );
	} else {
		req.flash('warning', 'password-reset-code-err');
		res.redirect( app.mountpath );
	}
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};

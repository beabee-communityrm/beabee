const express = require( 'express' );

const auth = require( __js + '/authentication' );
const { Referrals } =  require( __js + '/database' );
const { hasSchema } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const { completeSchema } = require( './schemas.json' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	if ( req.user.setupComplete ) {
		res.redirect( '/profile' );
	} else {
		res.locals.app = app_config;
		res.locals.breadcrumb.push( {
			name: app_config.title,
			url: app.parent.mountpath + app.mountpath
		} );
		res.locals.activeApp = app_config.uid;
		next();
	}
} );

app.use(auth.isLoggedIn);

app.get( '/', wrapAsync( async function( req, res ) {
	const referral = await Referrals.findOne({ referee: req.user });

	const isGift = req.user.contributionPeriod === 'gift';
	const isReferralWithGift = referral && referral.refereeGift;

	res.render( 'complete', { user: req.user, isReferralWithGift, isGift } );
} ) );

app.post( '/', hasSchema(completeSchema).orFlash, wrapAsync( async function( req, res ) {
	const { body : { password, delivery_optin, delivery_line1, delivery_line2,
		delivery_city, delivery_postcode, reason, how, shareable }, user } = req;

	const referral = await Referrals.findOne({ referee: req.user });

	const needAddress = delivery_optin || referral && referral.refereeGift ||
		user.contributionPeriod === 'gift';
	const gotAddress = delivery_line1 && delivery_city && delivery_postcode;

	if (needAddress && !gotAddress) {
		req.flash( 'error', 'address-required' );
		res.redirect( req.originalUrl );
	} else {
		const hashedPassword = await auth.generatePasswordPromise( password );
		await user.update( { $set: {
			password: hashedPassword,
			delivery_optin,
			delivery_address: needAddress ? {
				line1: delivery_line1,
				line2: delivery_line2,
				city: delivery_city,
				postcode: delivery_postcode
			} : {},
			join_reason: reason,
			join_how: how,
			join_shareable: !!shareable
		} } );

		res.redirect( '/profile' );
	}
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};

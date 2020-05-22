const express = require( 'express' );

const auth = require( __js + '/authentication' );
const { ReferralGifts, Referrals } = require( __js + '/database' );
const { hasSchema } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const { isGiftAvailable, updateGiftStock } = require( __apps + '/join/utils' );

const { chooseGiftSchema } = require( './schema.json' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.parent.mountpath + app.mountpath
	} );
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const referrals = await Referrals.find({ referrer: req.user }).populate('referee');
	const gifts = await ReferralGifts.find();
	for (const referral of referrals) {
		referral.referrerGiftDetails = gifts.find(gift => gift.name === referral.referrerGift);
	}

	res.render( 'index', { referralLink: req.user.referralLink, referrals } );
} ) );

app.get( '/:id', wrapAsync( async ( req, res ) => {
	const referral = await Referrals.findOne({ _id: req.params.id, referrer: req.user }).populate('referee');
	const gifts = await ReferralGifts.find();
	res.render( 'referral', { referral, gifts } );
} ) );

app.post( '/:id', hasSchema(chooseGiftSchema).orFlash, wrapAsync( async ( req, res ) => {
	const referral = await Referrals.findOne({ _id: req.params.id, referrer: req.user }).populate('referee');

	const giftParams = {
		referralGift: req.body.referralGift,
		referralGiftOptions: req.body.referralGiftOptions,
		amount: referral.refereeAmount
	};

	if (referral.referrerGift === undefined && await isGiftAvailable(giftParams)) {
		await Referrals.updateOne({
			_id: req.params.id,
			referrer: req.user
		}, {$set: {
			referrerGift: giftParams.referralGift,
			referrerGiftOptions: giftParams.referralGiftOptions
		}});

		await updateGiftStock(giftParams);

		req.flash( 'success', 'referral-gift-chosen' );
		res.redirect( app.parent.mountpath + app.mountpath );
	} else {
		req.flash( 'warning', 'referral-gift-invalid' );
		res.redirect( req.originalUrl );
	}
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};

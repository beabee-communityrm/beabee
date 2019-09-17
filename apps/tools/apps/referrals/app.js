const express = require( 'express' );
const moment = require( 'moment' );
const _ = require( 'lodash' );

const auth = require( __js + '/authentication' );
const { ReferralGifts } = require( __js + '/database' );
const { hasModel } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.use( ( req, res, next ) => {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	res.locals.activeApp = 'referrals';
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const gifts = await ReferralGifts.find();
	res.render( 'index', { gifts } );
} ) );

app.get( '/gifts/:name', hasModel( ReferralGifts, 'name' ), ( req, res ) => {
	// TODO: remove once https://github.com/pugjs/pug/pull/3179 is merged
	const stock = {};
	if (req.model.stock) {
		for (const [k, v] of req.model.stock) { stock[k] = v; }
	}

	res.render('gift', { gift: req.model, stock } );
} );

app.post( '/gifts/:name', hasModel( ReferralGifts, 'name' ), wrapAsync( async ( req, res ) => {
	console.log(req.body);

	if (req.body['delete-option']) {
		await req.model.update({$pull: {options: {name: req.body['delete-option']}}});
	} else if (req.body['delete-stock']) {
		await req.model.update({$unset: {['stock.' + req.body['delete-stock']]: 1}});
	} else {
		switch ( req.body.action ) {
		case 'update-gift':
			await req.model.update({$set: {
				label: req.body.label,
				description: req.body.description
			}});
			break;
		case 'update-options': {
			const options = null;
			await req.model.update({$set: {options}});
		}
		case 'update-stock': {
			const stock = _.zipObject(req.body.stock_ref, req.body.stock_count.map(Number));
			await req.model.update({$set: {stock}});
		}
		case 'delete':

		}
	}

	res.redirect( req.originalUrl );
} ) );

module.exports = config => {
	app_config = config;
	return app;
};

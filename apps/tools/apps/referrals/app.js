const express = require( 'express' );
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
	const data = req.body;

	if (data['delete-option']) {
		await req.model.update({$pull: {options: {name: data['delete-option']}}});
		req.flash( 'success', 'referral-gifts-option-deleted' );
	} else if (data['delete-stock']) {
		await req.model.update({$unset: {['stock.' + data['delete-stock']]: 1}});
		req.flash( 'success', 'referral-gifts-stock-deleted' );
	} else {
		switch ( data.action ) {
		case 'update-gift':
			await req.model.update({$set: {
				label: data.label,
				description: data.description,
				minAmount: Number(data.minAmount),
				enabled: data.enabled === 'true'
			}});
			req.flash( 'success', 'referral-gifts-updated' );
			break;
		case 'update-options': {
			const options = _.zip(data.option_name, data.option_values).map(([name, values]) => ({
				name,
				values: values.split(',').map(s => s.trim())
			})).filter(({name}) => !!name);
			await req.model.update({$set: {options}});
			req.flash( 'success', 'referral-gifts-options-updated' );
			break;
		}
		case 'update-stock': {
			const stock = _(data.stock_ref)
				.zipObject(data.stock_count)
				.pickBy(ref => !!ref)
				.mapValues(Number)
				.valueOf();
			await req.model.update({$set: {stock}});
			req.flash( 'success', 'referral-gifts-stock-updated' );
			break;
		}
		}
	}

	res.redirect( data.action === 'delete' ? '/tools/referrals' : req.originalUrl );
} ) );

module.exports = config => {
	app_config = config;
	return app;
};

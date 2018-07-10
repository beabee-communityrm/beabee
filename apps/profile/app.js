var __root = '../..';
var __src = __root + '/src';
var __js = __src + '/js';
var __config = __root + '/config';

var	express = require( 'express' ),
	app = express();

var moment = require( 'moment' );

var db = require( __js + '/database' ),
	Events = db.Events,
	Permissions = db.Permissions;

var config = require( __config + '/config.json' );

var auth = require( __js + '/authentication' );

var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	res.locals.activeApp = app_config.uid;

	if ( req.user && !req.user.setupComplete && req.originalUrl !== '/profile/complete') {
		res.redirect('/profile/complete');
	} else {
		next();
	}

} );

app.get( '/', auth.isLoggedIn, function( req, res ) {
	if ( auth.activeMember( req ) ) {
		if ( auth.checkPermission( req, config.permission.access ) ) {
			Permissions.findOne( { slug: config.permission.access }, function ( err, access ) {
				Events.aggregate( [
					{
						$match: {
							happened: { $gte: moment().startOf('month').toDate(), $lt: moment().endOf('month').toDate() },
							permission: access._id,
							member: req.user._id,
							successful: { $ne: false }
						}
					},
					{
						$group: {
							_id: {
								member: '$member',
								day: { $dayOfMonth: '$happened' }
							}
						}
					},
					{
						$group: {
							_id: '$_id.member',
							days: { $push: '$_id.day' }
						}
					},
					{
						$project: {
							_id: 0,
							count: { $size: '$days' }
						}
					},
					{
						$sort: { count: -1 }
					}
				], function ( err, result ) {
					var member = {};
					var permissions = req.user.permissions.filter( function( p ) {
						if ( p.permission && p.permission.slug ) {
							if ( p.permission.slug == config.permission.member ) {
								return true;
							}
						}
						return false;
					} );
					if ( permissions.length > 0 ) member = permissions[0];
					res.render( 'profile', {
						user: req.user,
						count: result,
						membership_expires: ( member.date_expires !== undefined ? member.date_expires : null ),
						membership_amount: ( req.user.gocardless.amount !== undefined ? req.user.gocardless.amount: null )
					} );
				} );
			} );
		} else {
			var membership_expires;
			var permissions = req.user.permissions.filter( function( p ) {
				if ( p.permission && p.permission.slug ) {
					if ( p.permission.slug == config.permission.member ) {
						return true;
					}
				}
				return false;
			} );
			if ( permissions.length > 0 ) {
				const expires = moment( permissions[0].date_expires );

				// If we're in the grace period assume payment has gone through
				if ( expires.subtract( config.gracePeriod ).isBefore() ) {
					membership_expires = expires.add({'years': 2}); // TODO: calculate next payment date
				} else {
					membership_expires = expires;
				}
			}
			res.render( 'profile', {
				user: req.user,
				membership_expires
			} );
		}
	} else {
		res.render( 'profile', { user: req.user } );
	}
} );

module.exports = function( config ) {
	app_config = config;
	return app;
};

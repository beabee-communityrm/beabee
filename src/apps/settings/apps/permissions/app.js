var	express = require( 'express' ),
	app = express();

var { Permissions } = require( '@core/database' );

var auth = require( '@core/authentication' );

app.set( 'views', __dirname + '/views' );

app.get( '/', auth.isSuperAdmin, function( req, res ) {
	Permissions.find( function( err, permissions ) {
		res.render( 'index', { permissions: permissions } );
	} );
} );

app.get( '/create', auth.isSuperAdmin, function( req, res ) {
	res.locals.breadcrumb.push( {
		name: 'Create'
	} );
	res.render( 'create' );
} );

app.post( '/create', auth.isSuperAdmin, function( req, res ) {
	if ( ! req.body.name || req.body.name.trim() === '' ) {
		req.flash( 'danger', 'permission-name-required' );
		res.redirect( app.parent.mountpath + app.mountpath );
		return;
	}

	if ( ! req.body.slug || req.body.slug.trim() === '' ) {
		req.flash( 'danger', 'permission-slug-required' );
		res.redirect( app.parent.mountpath + app.mountpath );
		return;
	}

	var permission = {
		name: req.body.name,
		event_name: req.body.event,
		event_unauthorised: req.body.event_unauthorised,
		slug: req.body.slug,
		description: req.body.description,
	};

	new Permissions( permission ).save( function () {
		req.flash( 'success', 'permission-created' );
		res.redirect( app.parent.mountpath + app.mountpath );
	} );
} );

app.get( '/:slug/edit', auth.isSuperAdmin, function( req, res ) {
	Permissions.findOne( { slug: req.params.slug }, function( err, permission ) {
		if ( ! permission ) {
			req.flash( 'warning', 'permission-404' );
			res.redirect( app.parent.mountpath + app.mountpath );
			return;
		}

		res.locals.breadcrumb.push( {
			name: permission.name
		} );
		res.render( 'edit', { permission: permission } );
	} );
} );

app.post( '/:slug/edit', auth.isSuperAdmin, function( req, res ) {
	if ( ! req.body.name || req.body.name.trim() === '' ) {
		req.flash( 'danger', 'permission-name-required' );
		res.redirect( app.parent.mountpath + app.mountpath );
		return;
	}

	if ( ! req.body.slug || req.body.slug.trim() === '' ) {
		req.flash( 'danger', 'permission-slug-required' );
		res.redirect( app.parent.mountpath + app.mountpath );
		return;
	}

	var permission = {
		name: req.body.name,
		event_name: req.body.event,
		event_unauthorised: req.body.event_unauthorised,
		slug: req.body.slug,
		description: req.body.description,
	};

	Permissions.update( { slug: req.params.slug }, permission, function () {
		req.flash( 'success', 'permission-updated' );
		res.redirect( app.parent.mountpath + app.mountpath );
	} );
} );

module.exports = app;

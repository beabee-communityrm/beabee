
const express = require( 'express' );

const auth = require( __js + '/authentication' );
const { Projects, ProjectMembers } = require( __js + '/database' );
const { hasModel } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const projects = await Projects.find();
	res.render( 'index', { projects } );
} ) );

function schemaToProject( data ) {
	const { title, description, status } = data;
	return { title, description, status };
}

app.post( '/', wrapAsync( async ( req, res ) => {
	const project = await Projects.create( {
		...schemaToProject( req.body ),
		owner: req.user
	} );
	req.flash( 'success', 'project-created' );
	res.redirect( '/projects/' + project._id);
} ) );

app.get( '/:_id', hasModel(Projects, '_id'), wrapAsync( async ( req, res ) => {
	await req.model.populate('owner polls').execPopulate();
	const projectMembers = await ProjectMembers.find( { project: req.model } ).populate( 'member' );

	res.render( 'project', { project: req.model, projectMembers } );
} ) );

app.post( '/:_id', hasModel(Projects, '_id'), wrapAsync( async ( req, res ) => {
	switch ( req.body.action ) {
	case 'update':
		await req.model.update( { $set: schemaToProject( req.body ) } );
		req.flash( 'success', 'project-updated' );
		break;
	case 'add-members':
		await ProjectMembers.create( req.body.members.map( member => ( {
			project: req.model, member
		} ) ) );
		req.flash( 'success', 'project-members-added' );
		break;
	}

	res.redirect( req.originalUrl );
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};

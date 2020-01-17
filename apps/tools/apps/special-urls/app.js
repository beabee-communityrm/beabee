const express = require( 'express' );
const moment = require( 'moment' );
const _ = require( 'lodash' );

const auth = require( __js + '/authentication' );
const { Members, SpecialUrlGroups, SpecialUrls } = require( __js + '/database' );
//const { hasSchema } = require( __js + '/middleware' );
const { loadParams, wrapAsync } = require( __js + '/utils' );

const activeMembers = require( __apps + '/tools/apps/exports/exports/activeMembers' );

//const { createNoticeSchema } = require( './schemas.json' );
const actions = require('./actions');

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
	res.locals.activeApp = 'special-urls';
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const specialUrlsParents = await SpecialUrls.find();
	const actionsWithParams = await loadParams(actions);

	res.render( 'index', { specialUrlsParents, actionsWithParams } );
} ) );

async function createSpecialUrls( data ) {
	const { name, expiresDate, expiresTime, linkDuration, actions: newActions } = data;

	const specialUrlGroup = await SpecialUrlGroups.create( {
		name,
		expires: expiresDate && moment.utc(`${expiresDate}T${expiresTime}`),
		enabled: false,
		actions: newActions
	} );

	const actionsByName = _(actions).map(action => [action.name, action]).fromPairs().valueOf();

	// TODO: Remove Number
	const linkExpires = linkDuration && moment.utc().add(Number(linkDuration), 'hours');

	const members = await Members.find(await activeMembers.getQuery());
	for (const member of members) {
		await SpecialUrls.create({
			group: specialUrlGroup,
			expires: linkExpires,
			actionParams: newActions.map(action => actionsByName[action.name].getUrlParams(member))
		});
	}

	return specialUrlGroup;
}

app.post( '/', /*hasSchema( createNoticeSchema ).orFlash,*/ wrapAsync( async ( req, res ) => {
	const specialUrlGroup = await createSpecialUrls( req.body );
	req.flash('success', 'special-urls-created');
	res.redirect('/tools/special-urls/' + specialUrlGroup._id);
} ) );

app.get( '/:id', wrapAsync( async ( req, res ) => {
	const specialUrlGroup = await SpecialUrlGroups.findById( req.params.id );
	const specialUrls = await SpecialUrls.find( { group: specialUrlGroup } );
	res.render( 'special-urls', { specialUrlGroup, specialUrls } );
} ) );

app.post( '/:id', wrapAsync( async ( req, res ) => {
	const specialUrlGroup = await SpecialUrlGroups.findById( req.params.id );

	switch ( req.body.action ) {
	case 'delete':
		await SpecialUrls.deleteMany({group: specialUrlGroup});
		await SpecialUrlGroups.deleteOne({_id: specialUrlGroup._id});
		req.flash( 'success', 'special-urls-deleted' );
		res.redirect( '/tools/special-urls' );
		break;
	}

} ) );

module.exports = config => {
	app_config = config;
	return app;
};

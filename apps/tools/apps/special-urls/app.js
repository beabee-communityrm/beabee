const express = require( 'express' );
const moment = require( 'moment' );
const _ = require( 'lodash' );

const auth = require( __js + '/authentication' );
const { Members, SpecialUrlGroups, SpecialUrls } = require( __js + '/database' );
const { hasModel/*, hasSchema*/ } = require( __js + '/middleware' );
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
	const specialUrlGroups = await SpecialUrlGroups.find();
	const actionsWithParams = await loadParams(actions);

	res.render( 'index', { specialUrlGroups, actionsWithParams } );
} ) );

async function createSpecialUrls( data ) {
	const { name, expiresDate, expiresTime, urlDuration, actions: newActions } = data;

	const specialUrlGroup = await SpecialUrlGroups.create( {
		name,
		expires: expiresDate && moment.utc(`${expiresDate}T${expiresTime}`),
		urlDuration,
		enabled: false,
		actions: newActions
	} );

	const actionsByName = _(actions).map(action => [action.name, action]).fromPairs().valueOf();

	// TODO: Remove Number
	const urlExpires = urlDuration && moment.utc().add(Number(urlDuration), 'hours');

	// TODO: support CSV upload
	const members = await Members.find(await activeMembers.getQuery());
	for (const member of members) {
		await SpecialUrls.create({
			group: specialUrlGroup,
			email: member.email,
			firstname: member.firstname,
			lastname: member.lastname,
			expires: urlExpires,
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

app.get( '/:_id', hasModel(SpecialUrlGroups, '_id'), wrapAsync( async ( req, res ) => {
	const specialUrls = await SpecialUrls.find( { group: req.model } );
	res.render( 'special-urls', { specialUrlGroup: req.model, specialUrls } );
} ) );

app.post( '/:_id', hasModel(SpecialUrlGroups, '_id'), wrapAsync( async ( req, res ) => {
	switch ( req.body.action ) {
	case 'enable':
		await req.model.update({$set: {enabled: true}});
		break;
	case 'disable':
		await req.model.update({$set: {enabled: false}});
		break;
	case 'force-expire':
		await SpecialUrls.updateMany({group: req.model}, {$set: {expires: moment()}});
		break;
	case 'delete':
		await SpecialUrls.deleteMany({group: req.model});
		await req.model.delete();
		req.flash( 'success', 'special-urls-deleted' );
		res.redirect( '/tools/special-urls' );
		return;
	}

	res.redirect( '/tools/special-urls/' + req.model._id );

} ) );

module.exports = config => {
	app_config = config;
	return app;
};

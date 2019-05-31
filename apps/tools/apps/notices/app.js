const express = require( 'express' );
const moment = require( 'moment' );
const _ = require( 'lodash' );

const auth = require( __js + '/authentication' );
const { Members, Notices } = require( __js + '/database' );
const { hasSchema } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const { createNoticeSchema } = require( './schemas.json' );

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
	res.locals.activeApp = 'notices';
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await Notices.find();
	res.render( 'index', { notices } );
} ) );

function schemaToNotice( data ) {
	const { name, expiresDate, expiresTime, text, url, enabled } = data;

	const expires = expiresDate && expiresTime && moment.utc(`${expiresDate}T${expiresTime}`);

	return { name, expires, text, url, enabled };
}

app.post( '/', hasSchema( createNoticeSchema ).orFlash, wrapAsync( async ( req, res ) => {
	const notice = await Notices.create( schemaToNotice( req.body ) );

	req.flash('success', 'notices-created');
	res.redirect('/tools/notices/' + notice._id);
} ) );

app.get( '/:id', wrapAsync( async ( req, res ) => {
	const notice = await Notices.findById( req.params.id );

	const members = await Members.find(
		{ notices: { $elemMatch: { notice_id: notice } } },
		{ 'notices.$.status': 1 }
	);

	const statuses = _(members)
		.flatMap('notices')
		.countBy('status')
		.map((count, status) => ({ name: status, count }))
		.valueOf();

	res.render( 'notice', { notice, statuses } );
} ) );

app.post( '/:id', wrapAsync( async ( req, res ) => {
	const notice = await Notices.findById( req.params.id );

	switch ( req.body.action ) {
	case 'update':
		await notice.update( { $set: schemaToNotice( req.body ) } );
		req.flash( 'success', 'notices-updated' );
		res.redirect( '/tools/notices/' + notice._id );
		break;

	case 'delete':
		await Notices.deleteOne({_id: notice._id});
		req.flash( 'success', 'notices-deleted' );
		res.redirect( '/tools/notices' );
		break;
	}

} ) );

module.exports = config => {
	app_config = config;
	return app;
};

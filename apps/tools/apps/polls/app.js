const express = require( 'express' );
const moment = require( 'moment' );
const _ = require( 'lodash' );

const auth = require( __js + '/authentication' );
const { PollAnswers, Polls } = require( __js + '/database' );
const { hasModel, hasSchema } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const { createPollSchema } = require( './schemas.json' );

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
	res.locals.activeApp = 'polls';
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const polls = await Polls.find();
	res.render( 'index', { polls } );
} ) );

function schemaToPoll( data ) {
	const { question, slug, closed } = data;

	return { question, slug, closed: !!closed };
}

app.post( '/', hasSchema( createPollSchema ).orFlash, wrapAsync( async ( req, res ) => {
	const poll = await Polls.create( schemaToPoll( req.body ) );
	req.flash('success', 'polls-created');
	res.redirect('/tools/polls/' + poll._id);
} ) );

app.get( '/:_id', hasModel(Polls, '_id'), wrapAsync( async ( req, res ) => {
	const pollAnswers = await PollAnswers.find( { poll: req.model } );
	const answerCounts = _(pollAnswers).groupBy('answer').mapValues('length').valueOf();
	res.render( 'poll', { poll: req.model, answerCounts } );
} ) );

app.post( '/:_id', hasModel(Polls, '_id'), wrapAsync( async ( req, res ) => {
	const poll = req.model;

	switch ( req.body.action ) {
	case 'update':
		await poll.update( { $set: schemaToPoll( req.body ) } );
		req.flash( 'success', 'polls-updated' );
		res.redirect( '/tools/polls/' + poll._id );
		break;

	case 'delete':
		await Polls.deleteOne({_id: poll._id});
		req.flash( 'success', 'polls-deleted' );
		res.redirect( '/tools/polls' );
		break;
	}

} ) );

module.exports = config => {
	app_config = config;
	return app;
};

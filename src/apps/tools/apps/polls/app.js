const express = require( 'express' );
const moment = require( 'moment' );

const auth = require( '@core/authentication' );
const { PollAnswers, Polls } = require( '@core/database' );
const { hasModel, hasSchema } = require( '@core/middleware' );
const { wrapAsync } = require( '@core/utils' );

const { createPollSchema } = require( './schemas.json' );

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.get( '/', wrapAsync( async ( req, res ) => {
	const polls = await Polls.find();
	res.render( 'index', { polls } );
} ) );

function schemaToPoll( data ) {
	const {
		question, slug, mergeField, pollMergeField, closed, allowUpdate, startsDate, startsTime,
		expiresDate, expiresTime, intro, thanksTitle, thanksText,
		formTemplate
	} = data;

	const starts = startsDate && startsTime && moment.utc(`${startsDate}T${startsTime}`);
	const expires = expiresDate && expiresTime && moment.utc(`${expiresDate}T${expiresTime}`);

	return {
		question, slug, mergeField, pollMergeField, starts, expires, intro, thanksTitle, thanksText,
		formTemplate,
		closed: !!closed,
		allowUpdate: allowUpdate === 'true'
	};
}

app.post( '/', hasSchema( createPollSchema ).orFlash, wrapAsync( async ( req, res ) => {
	const poll = await Polls.create( { ...schemaToPoll( req.body ), closed: true } );
	req.flash('success', 'polls-created');
	res.redirect('/tools/polls/' + poll._id);
} ) );

app.get( '/:_id', hasModel(Polls, '_id'), wrapAsync( async ( req, res ) => {
	const pollAnswersCount = await PollAnswers.count( { poll: req.model } );
	res.render( 'poll', { poll: req.model, pollAnswersCount } );
} ) );

app.get( '/:_id/responses', hasModel(Polls, '_id'), wrapAsync( async ( req, res ) => {
	const pollAnswers = await PollAnswers.find({ poll: req.model }).populate('member', 'firstname lastname uuid tags').exec();
	res.render( 'responses', { poll: req.model, pollAnswers });
} ) );

app.post( '/:_id', hasModel(Polls, '_id'), wrapAsync( async ( req, res ) => {
	const poll = req.model;

	switch ( req.body.action ) {
	case 'update':
		await poll.update( { $set: schemaToPoll( req.body ) } );
		req.flash( 'success', 'polls-updated' );
		res.redirect( '/tools/polls/' + poll._id );
		break;

	case 'edit-form':
		await poll.update( {
			$set: {
				formSchema: poll.formTemplate === 'builder' ?
					JSON.parse(req.body.formSchema) : req.body.formSchema
			}
		} );
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

module.exports = app;

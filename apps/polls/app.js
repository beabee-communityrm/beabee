const express = require( 'express' );
const _ = require('lodash');
const moment = require('moment');

const auth = require( '@core/authentication' );
const { Members, Polls, PollAnswers } = require( '@core/database' );
const { hasModel } = require( '@core/middleware' );
const { isSocialScraper, wrapAsync } = require( '@core/utils' );

const { getPollTemplate, hasPollAnswers, setAnswers, PollAnswerError } = require( './utils' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( ( req, res, next ) => {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	next();
} );

app.get( '/', auth.isLoggedIn, wrapAsync( async ( req, res ) => {
	const polls = await Polls.find({
		$or: [
			{starts: {$eq: null}},
			{starts: {$lt: moment.utc()}}
		]
	}).sort({date: -1});

	const pollAnswers = await PollAnswers.find( { member: req.user } );

	polls.forEach(poll => {
		poll.userAnswer = pollAnswers.find(pa => pa.poll.equals(poll._id));
	});

	const [activePolls, inactivePolls] = _.partition(polls, p => p.active);

	res.render( 'index', { activePolls, inactivePolls } );
} ) );

// TODO: move this to the main site
app.get( '/campaign2019', wrapAsync( async ( req, res, next ) => {
	const poll = await Polls.findOne( { slug: 'campaign2019' } );
	if ( auth.loggedIn( req ) === auth.NOT_LOGGED_IN ) {
		res.render( 'polls/campaign2019-landing', { poll } );
	} else {
		next();
	}
} ) );

app.get('/:slug', hasModel( Polls, 'slug' ), ( req, res, next ) => {
	if ( isSocialScraper( req ) ) {
		res.render( 'share' );
	} else {
		next();
	}
});

app.get( '/:slug', [
	auth.isLoggedIn,
	hasModel( Polls, 'slug' )
], wrapAsync( async ( req, res ) => {
	if (req.query.answers) {
		try {
			await setAnswers( req.model, req.user, req.query.answers, true );
		} catch (err) {
			if (!(err instanceof PollAnswerError)) {
				throw err;
			}
		}
		res.redirect( `/polls/${req.params.slug}#vote` );
	} else {
		const pollAnswer = await PollAnswers.findOne( { poll: req.model, member: req.user } );

		res.render( getPollTemplate( req.model ), {
			poll: req.model,
			answers: pollAnswer ? pollAnswer.answers : {},
			preview: req.query.preview && auth.canAdmin( req )
		} );
	}
} ) );

app.get( '/:slug/:code', hasModel(Polls, 'slug'), wrapAsync( async ( req, res ) => {
	const pollsCode = req.params.code.toUpperCase();

	// Prefill answers from URL
	if (req.query.answers) {
		const member = await Members.findOne( { pollsCode } );
		if (member) {
			try {
				await setAnswers( req.model, member, req.query.answers, true );
				req.session.answers = req.query.answers;
			} catch (err) {
				if (!(err instanceof PollAnswerError)) {
					throw err;
				}
			}
		}
		res.redirect( `/polls/${req.params.slug}/${req.params.code}#vote` );
	} else {
		res.render( getPollTemplate( req.model ), {
			poll: req.model,
			answers: req.session.answers || {},
			code: pollsCode
		} );

		delete req.session.answers;
	}
} ) );

app.post( '/:slug', [
	auth.isLoggedIn,
	hasModel(Polls, 'slug'),
	hasPollAnswers
], wrapAsync( async ( req, res ) => {
	try {
		await setAnswers( req.model, req.user, req.answers );
		res.redirect( `/polls/${req.params.slug}#thanks`);
	} catch (error) {
		if (error instanceof PollAnswerError) {
			req.flash( 'error', error.message);
			res.redirect( `/polls/${req.params.slug}#vote`);
		} else {
			throw error;
		}
	}
} ) );

app.post( '/:slug/:code', [
	hasModel(Polls, 'slug'),
	hasPollAnswers
], wrapAsync( async ( req, res ) => {
	const pollsCode = req.params.code.toUpperCase();

	try {
		const member = await Members.findOne( { pollsCode } );
		if (!member) {
			req.log.error({
				app: 'polls',
				action: 'vote'
			}, `Member not found with polls code "${pollsCode}"`);
			throw new PollAnswerError('polls-unknown-user');
		}

		await setAnswers( req.model, member, req.answers );

		req.session.answers = req.answers;
		res.cookie('memberId', member.uuid, { maxAge: 30 * 24 * 60 * 60 * 1000 });

		res.redirect( req.originalUrl + '#thanks' );
	} catch (error) {
		if (error instanceof PollAnswerError) {
			req.flash('error', error.message);
			res.redirect( req.originalUrl + '#vote' );
		} else {
			throw error;
		}
	}
} ) );

module.exports = config => {
	app_config = config;
	return app;
};

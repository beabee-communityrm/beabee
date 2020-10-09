const express = require( 'express' );
const _ = require('lodash');
const moment = require('moment');

const auth = require( __js + '/authentication' );
const { Members, Polls, PollAnswers } = require( __js + '/database' );
const { hasSchema, hasModel } = require( __js + '/middleware' );
const { isSocialScraper, wrapAsync } = require( __js + '/utils' );

const schemas = require( './schemas.json' );
const { getPollTemplate, setAnswers, PollAnswerError } = require( './utils' );

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
	hasModel(Polls, 'slug')
], wrapAsync( async ( req, res ) => {
	const answerSchema = req.model.formTemplate === 'builder' ?
		schemas.formAnswerSchema : schemas.answerSchemas[req.model.slug];
	const answers = req.model.formTemplate === 'builder' ?
		JSON.parse(req.body.answers) : req.body.answers;

	hasSchema(answerSchema).orFlash( req, res, async () => {
		try {
			await setAnswers( req.model, req.user, answers );
			res.redirect( `${req.originalUrl}` );
		} catch (error) {
			if (error instanceof PollAnswerError) {
				req.flash( 'error', error.message);
				res.redirect( `${req.originalUrl}#vote` );
			} else {
				throw error;
			}
		}
	});
} ) );

app.post( '/:slug/:code', [
	hasModel(Polls, 'slug')
], wrapAsync( async ( req, res ) => {
	const answerSchema = req.model.formTemplate === 'builder' ?
		schemas.formAnswerSchema : schemas.answerSchemas[req.model.slug];
	const answers = req.model.formTemplate === 'builder' ?
		JSON.parse(req.body.answers) : req.body.answers;

	hasSchema(answerSchema).orFlash( req, res, async () => {
		let errorMessage;
		const pollsCode = req.params.code.toUpperCase();
		const member = await Members.findOne( { pollsCode } );
		if ( member ) {
			try {
				await setAnswers( req.model, member, answers);
				req.session.answers = answers;
				res.cookie('memberId', member.uuid, { maxAge: 30 * 24 * 60 * 60 * 1000 });
			} catch (error) {
				if (error instanceof PollAnswerError) {
					errorMessage = error.message;
				} else {
					throw error;
				}
			}
		} else {
			errorMessage = 'polls-unknown-user';
			req.log.error({
				app: 'polls',
				action: 'vote'
			}, `Member not found with polls code "${pollsCode}"`);
		}

		if (errorMessage) {
			req.flash('error', errorMessage);
		}
		res.redirect( `/polls/${req.params.slug}/${req.params.code}${errorMessage ? '#vote' : ''}`);
	});
} ) );

module.exports = config => {
	app_config = config;
	return app;
};

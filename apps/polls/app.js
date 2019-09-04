const express = require( 'express' );

const auth = require( __js + '/authentication' );
const { Members, Polls, PollAnswers } = require( __js + '/database' );
const mailchimp = require( __js + '/mailchimp' );
const { hasSchema, hasModel } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

const schemas = require( './schemas.json' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( ( req, res, next ) => {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	res.locals.activeApp = app_config.uid;
	next();
} );

app.get( '/', auth.isLoggedIn, wrapAsync( async ( req, res ) => {
	const polls = await Polls.find();
	const pollAnswers = await PollAnswers.find( { member: req.user } );

	res.render( 'index', { polls, pollAnswers } );
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

app.get( '/:slug', [
	auth.isLoggedIn,
	hasModel(Polls, 'slug')
], wrapAsync( async ( req, res ) => {
	const pollAnswer = await PollAnswers.findOne( { poll: req.model, member: req.user } );

	const answer = pollAnswer ? {answer: pollAnswer.answer, ...pollAnswer.additionalAnswers} : {};

	const justAnswered = !!req.session.newAnswer;
	delete req.session.newAnswer;

	res.render( `polls/${req.model.slug}`, { answer, poll: req.model, justAnswered } );
} ) );

app.get( '/:slug/:code', hasModel(Polls, 'slug'), wrapAsync( async ( req, res ) => {
	const newAnswer = req.session.newAnswer;
	delete req.session.newAnswer;

	res.render( `polls/${req.model.slug}`, {
		poll: req.model,
		answer: newAnswer || {},
		code: req.params.code,
		justAnswered: !!newAnswer
	} );
} ) );

async function setAnswer( poll, member, { answer, ...additionalAnswers } ) {
	if (poll.closed) {
		throw new Error('Poll is closed');
	} else {
		console.log(answer, additionalAnswers);
		await PollAnswers.findOneAndUpdate( { member }, {
			$set: { poll, member, answer, additionalAnswers }
		}, { upsert: true } );

		await mailchimp.defaultLists.members.update( member.email, {
			merge_fields: {
				[poll.slug.toUpperCase()]: answer
			}
		} );
	}
}

app.post( '/:slug', [
	auth.isLoggedIn,
	hasModel(Polls, 'slug')
], wrapAsync( async ( req, res ) => {
	const answerSchema = schemas.answerSchemas[req.model.slug];
	hasSchema(answerSchema).orFlash( req, res, async () => {
		await setAnswer(req.model, req.user, req.body);
		req.session.newAnswer = true;
		res.redirect( `${req.originalUrl}#vote` );
	});
} ) );

app.post( '/:slug/:code', [
	hasSchema( schemas.voteLinkSchema ).orFlash,
	hasModel(Polls, 'slug')
], wrapAsync( async ( req, res ) => {
	const answerSchema = schemas.answerSchemas[req.model.slug];
	hasSchema(answerSchema).orFlash( req, res, async () => {
		const email = req.body.email.trim().toLowerCase();
		const pollsCode = req.params.code.toUpperCase();

		const member = await Members.findOne( { email, pollsCode } );
		if ( member ) {
			await setAnswer(req.model, member, req.body);
			req.session.newAnswer = req.body;
			res.cookie('memberId', member.uuid, { maxAge: 30 * 24 * 60 * 60 * 1000 });
		} else {
			req.flash( 'error', 'polls-unknown-user' );
			req.log.debug({
				app: 'polls',
				action: 'vote',
				error: 'Member not found with email address/polls code combo',
				sensitive: { email, pollsCode }
			});
		}

		res.redirect( `${req.originalUrl}#vote` );
	});
} ) );

module.exports = config => {
	app_config = config;
	return app;
};

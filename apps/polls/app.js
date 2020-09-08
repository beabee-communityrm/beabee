const express = require( 'express' );
const _ = require('lodash');

const auth = require( __js + '/authentication' );
const { Members, Polls, PollAnswers } = require( __js + '/database' );
const mailchimp = require( __js + '/mailchimp' );
const { hasSchema, hasModel } = require( __js + '/middleware' );
const { isSocialScraper, wrapAsync } = require( __js + '/utils' );

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
	next();
} );

app.get( '/', auth.isLoggedIn, wrapAsync( async ( req, res ) => {
	const polls = await Polls.find().sort({date: -1});
	const pollAnswers = await PollAnswers.find( { member: req.user } );

	polls.forEach(poll => {
		poll.answer = pollAnswers.find(pa => pa.poll.equals(poll._id));
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
	const pollAnswer = await PollAnswers.findOne( { poll: req.model, member: req.user } );
	const answer = pollAnswer ? {answer: pollAnswer.answer, ...pollAnswer.additionalAnswers} : {};
	res.render( req.model.formSchema ? 'poll' : `polls/${req.model.slug}`, {
		answer,
		poll: req.model,
		preview: req.query.preview && auth.canAdmin( req )
	} );
} ) );

app.get( '/:slug/:code', hasModel(Polls, 'slug'), wrapAsync( async ( req, res ) => {
	const pollsCode = req.params.code.toUpperCase();

	if (req.query.answer) {
		const member = await Members.findOne( { pollsCode } );
		if (member) {
			await setAnswer( req.model, member, { isAsync: true, answer: req.query.answer } );
		}
	}

	const answer = req.session.answer || {};
	delete req.session.answer;

	res.render( req.model.formSchema ? 'poll' : `polls/${req.model.slug}`, {
		poll: req.model, answer, code: pollsCode
	} );
} ) );

// TODO: remove _csrf in a less hacky way
async function setAnswer( poll, member, { answer, _csrf, isAsync, ...otherAdditionalAnswers } ) { // eslint-disable-line no-unused-vars
	if (!member.isActiveMember) {
		return 'polls-expired-user';
	} else if (poll.active) {
		if (!poll.allowUpdate) {
			const pollAnswer = await PollAnswers.findOne({ member, poll });
			if (pollAnswer) {
				return 'polls-cant-update';
			}
		}

		if (poll.formSchema) {
			otherAdditionalAnswers = JSON.parse(answer);
			answer = 'Yes';
		}

		const additionalAnswers = isAsync ?  { 'additionalAnswers.isAsync': true } :
			{ 'additionalAnswers': otherAdditionalAnswers };

		await PollAnswers.findOneAndUpdate( { poll, member }, {
			$set: { poll, member, answer, ...additionalAnswers }
		}, { upsert: true } );

		if (poll.mergeField) {
			await mailchimp.mainList.updateMemberFields( member, {
				[poll.mergeField]: answer
			} );
		}
	} else {
		return 'polls-closed';
	}
}

app.post( '/:slug', [
	auth.isLoggedIn,
	hasModel(Polls, 'slug')
], wrapAsync( async ( req, res ) => {
	const answerSchema = req.model.formSchema ?
		schemas.formAnswerSchema : schemas.answerSchemas[req.model.slug];
	hasSchema(answerSchema).orFlash( req, res, async () => {
		const error = await setAnswer( req.model, req.user, req.body );
		if (error) {
			req.flash( 'error', error );
		}
		res.redirect( `${req.originalUrl}#vote` );
	});
} ) );

app.post( '/:slug/:code', [
	hasModel(Polls, 'slug')
], wrapAsync( async ( req, res ) => {
	const answerSchema = schemas.answerSchemas[req.model.slug];
	hasSchema(answerSchema).orFlash( req, res, async () => {
		const pollsCode = req.params.code.toUpperCase();
		const member = await Members.findOne( { pollsCode } );
		if ( member ) {
			const error = await setAnswer( req.model, member, req.body );
			if (error) {
				req.flash( 'error', error );
			} else {
				req.session.answer = req.body;
				res.cookie('memberId', member.uuid, { maxAge: 30 * 24 * 60 * 60 * 1000 });
			}
		} else {
			req.flash( 'error', 'polls-unknown-user' );
			req.log.debug({
				app: 'polls',
				action: 'vote',
				error: 'Member not found with email address/polls code combo',
				sensitive: { pollsCode }
			});
		}

		res.redirect( `/polls/${req.params.slug}/${req.params.code}#vote` );
	});
} ) );

module.exports = config => {
	app_config = config;
	return app;
};

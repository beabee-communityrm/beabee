const express = require( 'express' );

const auth = require( __js + '/authentication' );
const { Members, Polls, PollAnswers } = require( __js + '/database' );
const mailchimp = require( __js + '/mailchimp' );
const { hasSchema } = require( __js + '/middleware' );
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

app.get( '/:slug', auth.isLoggedIn, wrapAsync( async ( req, res ) => {
	const poll = await Polls.findOne( { slug: req.params.slug } );
	if (poll) {
		const answer = await PollAnswers.findOne( { poll, member: req.user } );
		const showShare = !!res.locals.flashes.find(m => m.type === 'success');
		res.render( `polls/${poll.slug}`, { poll, answer, showShare } );
	}
} ) );

app.get( '/:slug/:code', wrapAsync( async ( req, res ) => {
	const poll = await Polls.findOne( { slug: req.params.slug } );
	if ( poll ) {
		const showShare = !!res.locals.flashes.find(m => m.type === 'success');
		res.render( 'poll', { poll, code: req.params.code, showShare } );
	}
} ) );

async function setAnswer( poll, member, { answer, ...additionalAnswers } ) {
	if (poll.closed) {
		throw new Error('Poll is closed');
	} else {
		await PollAnswers.findOneAndUpdate( { member }, {
			$set: { poll, member, answer, ...additionalAnswers }
		}, { upsert: true } );

		await mailchimp.defaultLists.members.update( member.email, {
			merge_fields: {
				[poll.slug.toUpperCase()]: answer
			}
		} );
	}
}

app.post( '/:slug', auth.isLoggedIn, wrapAsync( async ( req, res ) => {
	const poll = await Polls.findOne( { slug: req.params.slug } );
	if (poll) {
		const answerSchema = schemas.answerSchemas[poll.slug];
		hasSchema(answerSchema).orFlash( req, res, async () => {
			await setAnswer(poll, req.user, req.body);
			req.flash( 'success', 'polls-answer-chosen' );
			res.redirect( `${req.originalUrl}#vote` );
		});
	}
} ) );

app.post( '/:slug/:code', hasSchema( schemas.voteLinkSchema ).orFlash, wrapAsync( async ( req, res ) => {
	const poll = await Polls.findOne( { slug: req.params.slug } );
	if (poll) {
		const answerSchema = schemas.answerSchemas[poll.slug];
		hasSchema(answerSchema).orFlash( req, res, async () => {
			const email = req.body.email.trim().toLowerCase();
			const pollsCode = req.params.code.toUpperCase();

			const member = await Members.findOne( { email, pollsCode } );
			if ( member ) {
				await setAnswer(poll, member, req.body);
				req.flash( 'success', 'polls-answer-chosen' );
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
	}
} ) );

module.exports = config => {
	app_config = config;
	return app;
};

const express = require( 'express' );

const auth = require( __js + '/authentication' );
const { Members, Polls, PollAnswers } = require( __js + '/database' );
const mailchimp = require( __js + '/mailchimp' );
const { hasSchema } = require( __js + '/middleware' );
const { wrapAsync } = require( __js + '/utils' );

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

app.get( '/:slug', wrapAsync( async ( req, res, next ) => {
	const poll = await Polls.findOne( { slug: req.params.slug } );
	if (poll) {
		if (req.user) {
			const answer = await PollAnswers.findOne( { poll, member: req.user } );
			const showShare = !!res.locals.flashes.find(m => m.type === 'success');
			res.render( 'poll', { poll, answer, showShare } );
		} else {
			res.render( 'poll-landing', { poll } );
		}
	} else {
		next();
	}
} ) );

app.get( '/:slug/:code', wrapAsync( async ( req, res, next ) => {
	const poll = await Polls.findOne( { slug: req.params.slug } );
	if ( req.user ) {
		res.redirect( '/polls/' + req.params.slug );
	} else if ( poll ) {
		const showShare = !!res.locals.flashes.find(m => m.type === 'success');
		res.render( 'poll', { poll, code: req.params.code, showShare } );
	} else {
		next();
	}
} ) );

async function setAnswer( pollSlug, member, { answer, reason, shareable, volunteer, idea } ) {
	const poll = await Polls.findOne( { slug: pollSlug } );

	if (poll.closed) {
		throw new Error('Poll is closed');
	} else {
		await PollAnswers.findOneAndUpdate( { member: member }, {
			$set: {
				poll, member, answer, reason, shareable, volunteer, idea
			}
		}, { upsert: true } );

		await mailchimp.defaultLists.members.update( member.email, {
			merge_fields: {
				CMPGN2019: answer
			}
		} );
	}

	return answer;
}

const answerSchema = {
	body: {
		type: 'object',
		required: ['answer'],
		properties: {
			answer: {
				type: 'string',
				enum: ['1', '2']
			},
			reason: {
				type: 'string'
			},
			shareable: {
				type: 'boolean'
			},
			volunteer: {
				type: 'boolean'
			},
			idea: {
				type: 'string'
			},
		}
	}
};

app.post( '/:slug', [
	auth.isLoggedIn,
	hasSchema( answerSchema ).orFlash,
], wrapAsync( async ( req, res ) => {
	await setAnswer(req.params.slug, req.user, req.body);
	req.flash( 'success', 'polls-answer-chosen' );
	res.redirect( `/polls/${req.params.slug}#vote` );
} ) );

app.post( '/:slug/:code', [
	hasSchema( answerSchema ).orFlash,
	hasSchema( { body: {
		type: 'object',
		required: ['email'],
		properties: {
			email: {
				type: 'string'
			}
		}
	} } ).orFlash
], wrapAsync( async ( req, res ) => {
	const email = req.body.email.trim().toLowerCase();
	const pollsCode = req.params.code.toUpperCase();

	const member = await Members.findOne( { email, pollsCode } );

	if ( member ) {
		await setAnswer(req.params.slug, member, req.body);
		req.flash( 'success', 'polls-answer-chosen' );
		res.cookie('memberId', member.uuid, { maxAge: 30 * 24 * 60 * 60 * 1000 });
	} else {
		req.flash( 'error', 'polls-unknown-user' );
		req.log.debug({
			app: 'polls',
			action: 'vote',
			error: 'Member not found with emai address/polls code combo',
			sensitive: { email, pollsCode }
		});
	}

	res.redirect( `/polls/${req.params.slug}/${req.params.code}#vote` );
} ) );

module.exports = config => {
	app_config = config;
	return app;
};

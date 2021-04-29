import express, { NextFunction, Request, Response } from 'express';
import _ from 'lodash';
import { getRepository } from 'typeorm';

import { hasNewModel, hasSchema, isLoggedIn } from '@core/middleware';
import { isSocialScraper, wrapAsync } from '@core/utils';
import * as auth from '@core/utils/auth';

import MembersService from '@core/services/MembersService';
import PollsService from '@core/services/PollsService';

import Poll, { PollAccess } from '@models/Poll';
import { PollResponseAnswers } from '@models/PollResponse';

import schemas from './schemas.json';

import config from '@config';

function getView(poll: Poll): string {
	switch (poll.template) {
	case 'ballot': return 'ballot';
	case 'builder': return 'poll';
	case 'custom': return `polls/${poll.slug}`;
	}
}

function hasPollAnswers(req: Request, res: Response, next: NextFunction): void {
	const poll = req.model as Poll;
	const schema = (() => {
		switch (poll.template) {
		case 'ballot': return schemas.ballotSchema;
		case 'builder': return schemas.builderSchema;
		case 'custom': return (schemas.customSchemas  as any)[poll.slug];
		}
	})();

	hasSchema(schema).orFlash(req, res, () => {
		req.answers = poll.template === 'builder' ?
			JSON.parse(req.body.answers) : req.body.answers;
		// TODO: validate answers
		next();
	});
}

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', isLoggedIn, wrapAsync( async ( req, res ) => {
	const polls = await PollsService.getVisiblePollsWithResponses(req.user!);
	const [activePolls, inactivePolls] = _.partition(polls, p => p.active);
	res.render( 'index', { activePolls, inactivePolls } );
} ) );

app.get('/_oembed', wrapAsync( async (req, res, next) => {
	const url = req.query.url as string;
	if (url && url.startsWith(config.audience + '/polls/')) {
		const pollId = url.replace(config.audience + '/polls/', '').replace(/\/embed\/?/, '');
		const poll = await getRepository(Poll).findOne(pollId);
		if (poll) {
			res.send({
				type: 'rich',
				title: poll.title,
				html: `<iframe src="${config.audience}/polls/${pollId}/embed" frameborder="0" style="display: block; width: 100%"></iframe>`
			});
			return;
		}
	}

	next('route');
}));

// TODO: move this to the main site
app.get( '/campaign2019', wrapAsync( async ( req, res, next ) => {
	const poll = await getRepository(Poll).findOne( { slug: 'campaign2019' } );
	if ( auth.loggedIn( req ) === auth.AuthenticationStatus.NOT_LOGGED_IN ) {
		res.render( 'polls/campaign2019-landing', { poll } );
	} else {
		next();
	}
} ) );

app.get('/:slug', hasNewModel( Poll, 'slug' ), ( req, res, next ) => {
	if ( isSocialScraper( req ) ) {
		res.render( 'share' );
	} else {
		next();
	}
});

function getSessionAnswers(req: Request) {
	const answers = req.session.answers;
	delete req.session.answers;
	return answers;
}

async function getUserAnswers(req: Request) {
	return getSessionAnswers(req) ||
		req.user && (await PollsService.getResponse(req.model as Poll, req.user))?.answers;
}

app.get( '/:slug:embed(/embed)?', [
	hasNewModel( Poll, 'slug' )
], wrapAsync( async ( req, res ) => {
	const poll = req.model as Poll;
	const isEmbed = !!req.params.embed;
	const user = isEmbed ? undefined : req.user;
	if (poll.access === PollAccess.Member && !user) {
		return auth.handleNotAuthed(auth.AuthenticationStatus.NOT_LOGGED_IN, req, res);
	}

	const answers = req.query.answers as PollResponseAnswers;
	// Handle partial answers from URL
	if (answers) {
		if (user) {
			await PollsService.setResponse( poll, user, answers, true );
		} else {
			req.session.answers = answers;
		}
		res.redirect( `/polls/${poll.slug}#vote` );
	} else {
		if (isEmbed) {
			res.removeHeader('X-Frame-Options');
		}
		res.render( getView( poll ), {
			poll, isEmbed,
			isGuest: isEmbed || !user,
			answers: await getUserAnswers(req) || {},
			preview: req.query.preview && auth.canAdmin( req ) === auth.AuthenticationStatus.LOGGED_IN
		} );
	}
} ) );

app.post( '/:slug:embed(/embed)?', [
	hasNewModel(Poll, 'slug'),
	hasPollAnswers
], wrapAsync( async ( req, res ) => {
	const poll = req.model as Poll;
	const isEmbed = !!req.params.embed;
	const user = isEmbed ? undefined : req.user;

	if (poll.access === PollAccess.Member && !user) {
		return auth.handleNotAuthed(auth.AuthenticationStatus.NOT_LOGGED_IN, req, res);
	}

	let error;
	if (user) {
		error = await PollsService.setResponse( poll, user, req.answers! );
	} else {
		const {guestName, guestEmail} = req.body;
		if (guestName && guestEmail || poll.access === PollAccess.Anonymous) {
			error = await PollsService.setGuestResponse( poll, guestName, guestEmail, req.answers! );
		} else {
			error = 'polls-guest-fields-missing';
		}
	}

	if (error) {
		req.flash('error', error);
		res.redirect( `/polls/${poll.slug}#vote`);
	} else {
		if (!req.user) {
			req.session.answers = req.answers;
		}
		res.redirect( (poll.templateSchema.thanksRedirect as string) || `/polls/${poll.slug}/thanks`);
	}
} ) );

app.get( '/:slug/thanks', hasNewModel(Poll, 'slug'), wrapAsync(async (req, res) => {
	const poll = req.model as Poll;
	const answers = await getUserAnswers(req);
	if (answers) {
		res.render(poll.template === 'custom' ? getView(poll) : 'thanks', {poll, answers});
	} else {
		res.redirect('/polls/' + poll.slug);
	}
}));

app.get( '/:slug/:code', hasNewModel(Poll, 'slug'), wrapAsync( async ( req, res ) => {
	const poll = req.model as Poll;
	const answers = req.query.answers as PollResponseAnswers;
	const pollsCode = req.params.code.toUpperCase();

	// Prefill answers from URL
	if (answers) {
		const member = await MembersService.findOne( { pollsCode } );
		if (member) {
			const error = await PollsService.setResponse( poll, member, answers, true );
			if (!error) {
				req.session.answers = answers;
			}
		}
		res.redirect( `/polls/${poll.slug}/${pollsCode}#vote` );
	} else {
		res.render( getView( poll ), {
			poll: req.model,
			isGuest: false,
			answers: getSessionAnswers(req) || {},
			code: pollsCode
		} );
	}
} ) );

app.post( '/:slug/:code', [
	hasNewModel(Poll, 'slug'),
	hasPollAnswers
], wrapAsync( async ( req, res ) => {
	const poll = req.model as Poll;
	const pollsCode = req.params.code.toUpperCase();
	let error;

	const member = await MembersService.findOne( { pollsCode } );
	if (member) {
		res.cookie('memberId', member.id, { maxAge: 30 * 24 * 60 * 60 * 1000 });
		error = await PollsService.setResponse( poll, member, req.answers! );
	} else {
		error = 'polls-unknown-user';
	}

	if (error) {
		req.flash('error', error);
		res.redirect( `/polls/${poll.slug}/${pollsCode}#vote` );
	} else {
		req.session.answers = req.answers;
		res.redirect( (poll.templateSchema.thanksRedirect as string) || `/polls/${poll.slug}/thanks`);
	}
} ) );

module.exports = app;

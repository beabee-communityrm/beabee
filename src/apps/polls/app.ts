import express, { NextFunction, Request, Response } from 'express';
import _ from 'lodash';
import { getRepository } from 'typeorm';

import auth from '@core/authentication';
import { Members } from '@core/database';
import { hasNewModel, hasSchema } from '@core/middleware';
import { hasUser, isSocialScraper, wrapAsync } from '@core/utils';

import PollsService from '@core/services/PollsService';

import Poll from '@models/Poll';

import schemas from './schemas.json';

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

app.get( '/', auth.isLoggedIn, wrapAsync( async ( req, res ) => {
	const polls = await PollsService.getPollsWithResponses(req.user!);
	const [activePolls, inactivePolls] = _.partition(polls, p => p.active);
	res.render( 'index', { activePolls, inactivePolls } );
} ) );

// TODO: move this to the main site
app.get( '/campaign2019', wrapAsync( async ( req, res, next ) => {
	const poll = await getRepository(Poll).findOne( { slug: 'campaign2019' } );
	if ( auth.loggedIn( req ) === auth.NOT_LOGGED_IN ) {
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

app.get( '/:slug', [
	auth.isLoggedIn,
	hasNewModel( Poll, 'slug' )
], wrapAsync( hasUser( async ( req, res ) => {
	const poll = req.model as Poll;
	const answers = req.query.answers as Record<string, unknown>;
	if (answers) {
		const error = await PollsService.setResponse( poll, req.user, answers, true );
		if (error) {
			req.flash('error', error);
		}
		res.redirect( `/polls/${poll.slug}#vote` );
	} else {
		const pollAnswer = await PollsService.getResponse( poll, req.user );

		res.render( getView( poll ), {
			poll,
			answers: pollAnswer ? pollAnswer.answers : {},
			preview: req.query.preview && auth.canAdmin( req )
		} );
	}
} ) ) );

app.get( '/:slug/:code', hasNewModel(Poll, 'slug'), wrapAsync( async ( req, res ) => {
	const poll = req.model as Poll;
	const answers = req.query.answers as Record<string, unknown>;
	const pollsCode = req.params.code.toUpperCase();

	// Prefill answers from URL
	if (answers) {
		const member = await Members.findOne( { pollsCode } );
		if (member) {
			const error = await PollsService.setResponse( poll, member, answers, true );
			if (error) {
				req.flash('error', error);
			} else {
				req.session.answers = answers;
			}
		}
		res.redirect( `/polls/${poll.slug}/${req.params.code}#vote` );
	} else {
		res.render( getView( poll ), {
			poll: req.model,
			answers: req.session.answers || {},
			code: pollsCode
		} );

		delete req.session.answers;
	}
} ) );

app.post( '/:slug', [
	auth.isLoggedIn,
	hasNewModel(Poll, 'slug'),
	hasPollAnswers
], wrapAsync( async ( req, res ) => {
	const error = await PollsService.setResponse( req.model as Poll, req.user!, req.answers! );
	if (error) {
		req.flash('error', error);
		res.redirect( `/polls/${req.params.slug}#vote`);
	} else {
		res.redirect( `/polls/${req.params.slug}#thanks`);
	}
} ) );

app.post( '/:slug/:code', [
	hasNewModel(Poll, 'slug'),
	hasPollAnswers
], wrapAsync( async ( req, res ) => {
	const pollsCode = req.params.code.toUpperCase();
	let error;

	const member = await Members.findOne( { pollsCode } );
	if (member) {
		res.cookie('memberId', member.uuid, { maxAge: 30 * 24 * 60 * 60 * 1000 });
		error = await PollsService.setResponse( req.model as Poll, member, req.answers! );
	} else {
		req.log.error({
			app: 'polls',
			action: 'vote'
		}, `Member not found with polls code "${pollsCode}"`);
		error = 'polls-unknown-user';
	}

	if (error) {
		req.flash('error', error);
		res.redirect( req.originalUrl + '#vote' );
	} else {
		req.session.answers = req.answers;
		res.redirect( req.originalUrl + '#thanks' );
	}
} ) );

module.exports = app;

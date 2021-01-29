import express from 'express';
import moment from 'moment';

import auth from '@core/authentication';
import { hasNewModel, hasSchema } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import { createPollSchema } from './schemas.json';
import Poll, { PollTemplate } from '@models/Poll';
import { getRepository } from 'typeorm';
import PollResponse from '@models/PollResponse';
import { Members } from '@core/database';

interface CreatePollSchema {
	title: string
	slug: string
	closed?: boolean
	mcMergeField?: string
	pollMergeField?: string
	allowUpdate?: boolean
	startsDate?: string
	startsTime?: string
	expiresDate?: string
	expiresTime?: string
	template: PollTemplate
}

function schemaToPoll( data: CreatePollSchema ): Omit<Poll, 'templateSchema'> {
	const { startsDate, startsTime, expiresDate, expiresTime } = data;

	const poll = new Poll();
	poll.title = data.title;
	poll.slug = data.slug;
	poll.closed = !!data.closed;
	poll.mcMergeField = data.mcMergeField;
	poll.pollMergeField = data.pollMergeField;
	poll.template = data.template;
	poll.allowUpdate = !!data.allowUpdate;

	if (startsDate && startsTime) {
		poll.starts = moment.utc(`${startsDate}T${startsTime}`).toDate();
	}
	if (expiresDate && expiresTime) {
		poll.expires = moment.utc(`${expiresDate}T${expiresTime}`).toDate();
	}

	return poll;
}

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.get( '/', wrapAsync( async ( req, res ) => {
	const polls = await getRepository(Poll).find();
	res.render( 'index', { polls } );
} ) );

app.post( '/', hasSchema( createPollSchema ).orFlash, wrapAsync( async ( req, res ) => {
	const poll = await getRepository(Poll).save(schemaToPoll( req.body ));
	req.flash('success', 'polls-created');
	res.redirect('/tools/polls/' + poll.slug);
} ) );

app.get( '/:slug', hasNewModel(Poll, 'slug'), wrapAsync( async ( req, res ) => {
	const responsesCount = await getRepository(PollResponse).count({where: {poll: req.model}});
	res.render( 'poll', { poll: req.model, responsesCount } );
} ) );

app.get( '/:slug/responses', hasNewModel(Poll, 'slug'), wrapAsync( async ( req, res ) => {
	const responses = await getRepository(PollResponse).find({
		where: {poll: req.model }
	});
	// TODO: Remove when members are in ORM
	const members = await Members.find({_id: {$in: responses.map(r => r.memberId)}}, 'firstname lastname uuid');
	const responsesWithMember = responses.map(response => ({
		...response,
		member: members.find(m => m.id === response.memberId)
	}));
	res.render( 'responses', { poll: req.model, responses: responsesWithMember });
} ) );

app.post( '/:slug', hasNewModel(Poll, 'slug'), wrapAsync( async ( req, res ) => {
	const poll = req.model as Poll;

	switch ( req.body.action ) {
	case 'update':
		await getRepository(Poll).update(poll.slug, schemaToPoll(req.body));
		req.flash( 'success', 'polls-updated' );
		res.redirect( req.originalUrl );
		break;

	case 'edit-form': {
		const templateSchema = req.body.templateSchema;
		if (poll.template === 'builder') {
			templateSchema.formSchema = JSON.parse(req.body.formSchema);
		}
		await getRepository(Poll).update(poll.slug, {templateSchema});
		req.flash( 'success', 'polls-updated' );
		res.redirect( req.originalUrl );
		break;
	}
	case 'delete':
		await getRepository(Poll).delete(poll.slug);
		req.flash( 'success', 'polls-deleted' );
		res.redirect( '/tools/polls' );
		break;
	}

} ) );

export default app;

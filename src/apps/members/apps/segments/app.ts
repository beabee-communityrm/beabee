import express from 'express';
import { createQueryBuilder, getRepository } from 'typeorm';

import { hasNewModel } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import EmailService  from '@core/services/EmailService';
import SegmentService from '@core/services/SegmentService';

import Segment from '@models/Segment';
import SegmentOngoingEmail from '@models/SegmentOngoingEmail';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get('/', wrapAsync(async (req, res) => {
	const segments = await SegmentService.getSegmentsWithCount();
	res.render('index', {segments});
}));

app.get('/:id', hasNewModel(Segment, 'id'), wrapAsync(async (req, res) => {
	const segment = req.model as Segment;
	const ongoingEmails = await getRepository(SegmentOngoingEmail).find({where: {segment}});
	for (const ongoingEmail of ongoingEmails) {
		ongoingEmail.emailTemplate = await EmailService.getTemplate(ongoingEmail.emailTemplateId);
	}
	res.render('segment', {segment, ongoingEmails});
}));

app.post('/:id', hasNewModel(Segment, 'id'), wrapAsync(async (req, res) => {
	const segment = req.model as Segment;

	switch (req.body.action) {
	case 'update':
		await getRepository(Segment).update(segment.id, {
			name: req.body.name,
			description: req.body.description || '',
			order: req.body.order || 0
		});
		req.flash('success', 'segment-updated');
		res.redirect(req.originalUrl);
		break;
	case 'update-rules':
		await getRepository(Segment).update(segment.id, {
			ruleGroup: JSON.parse(req.body.rules)
		});
		req.flash('success', 'segment-updated');
		res.redirect(req.originalUrl);
		break;
	case 'toggle-ongoing-email':
		await getRepository(SegmentOngoingEmail).update(
			req.body.ongoingEmailId,
			{enabled: req.body.ongoingEmailEnabled === 'true'}
		);
		res.redirect('/members/segments/' + segment.id + '#ongoingemails');
		break;
	case 'delete-ongoing-email':
		await getRepository(SegmentOngoingEmail).delete(req.body.ongoingEmailId);
		res.redirect('/members/segments/' + segment.id + '#ongoingemails');
		break;
	case 'delete':
		await getRepository(Segment).delete(segment.id);
		req.flash('success', 'segment-deleted');
		res.redirect('/members/segments');
		break;
	}
}));

app.get('/:id/email', hasNewModel(Segment, 'id'), wrapAsync(async (req, res) => {
	res.render('email', {
		segment: req.model,
		emailTemplates: await EmailService.getTemplates()
	});
}));

interface CreateBaseEmail {
	email: string
}

interface CreateOneOffEmail extends CreateBaseEmail {
	type: 'one-off'
}

interface CreateOngoingEmail extends CreateBaseEmail {
	type: 'ongoing'
	trigger: 'onJoin'|'onLeave'
	enabled?: 'true'
}

type CreateEmail = CreateOneOffEmail|CreateOngoingEmail;

app.post('/:id/email', hasNewModel(Segment, 'id'), wrapAsync(async (req, res) => {
	const segment = req.model as Segment;
	const data = req.body as CreateEmail;

	if (data.type === 'one-off') {
		throw new Error('Not implemented');
	} else {
		await getRepository(SegmentOngoingEmail).save({
			segment,
			trigger: data.trigger,
			emailTemplateId: data.email,
			enabled: !!data.enabled
		});

		res.redirect('/members/segments/' + segment.id + '#ongoingemails');
	}
}));

export default app;

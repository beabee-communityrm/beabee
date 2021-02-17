import express from 'express';
import { getRepository } from 'typeorm';

import { Members } from '@core/database';
import { hasNewModel } from '@core/middleware';
import { wrapAsync } from '@core/utils';
import { parseRuleGroup } from '@core/utils/rules';

import Segment from '@models/Segment';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get('/', wrapAsync(async (req, res) => {
	const segments = await getRepository(Segment).find();
	for (const segment of segments) {
		segment.memberCount = await Members.count(parseRuleGroup(segment.ruleGroup));
	}
	res.render('index', {segments});
}));

app.get('/:id', hasNewModel(Segment, 'id'), (req, res) => {
	res.render('segment', {segment: req.model});
});

app.post('/:id', hasNewModel(Segment, 'id'), wrapAsync(async (req, res) => {
	const segment = req.model as Segment;

	switch (req.body.action) {
	case 'update':
		await getRepository(Segment).update(segment.id, {
			name: req.body.name,
			description: req.body.description || ''
		});
		req.flash('success', 'segment-updated');
		res.redirect(req.originalUrl);
		break;
	case 'delete':
		await getRepository(Segment).delete(segment.id);
		req.flash('success', 'segment-deleted');
		res.redirect('/members/segments');
		break;
	}
}));

export default app;

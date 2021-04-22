import express from 'express';
import moment from 'moment';
import { createQueryBuilder, getRepository } from 'typeorm';

import { isSuperAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import NewsletterService from '@core/services/NewsletterService';
import OptionsService from '@core/services/OptionsService';

import Member from '@models/Member';

import config from '@config';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index', {provider: config.newsletter.provider});
});

async function setResyncStatus(message: string) {
	await OptionsService.set('newsletter-resync-status', `[${moment.utc().format('HH:mm')}] ${message}`);
}

app.post('/', wrapAsync(async (req, res) => {
	if (req.body.action === 'resync') {
		req.flash('success', 'newsletter-resync-started');
		res.redirect(req.originalUrl);

		try {
			await setResyncStatus('Uploading contacts to newsletter list');

			const members = await createQueryBuilder(Member).limit(100).getMany();
			await NewsletterService.upsertMembers(members, false);

			await setResyncStatus('Importing contacts from newsletter list');

			await OptionsService.reset('newsletter-resync-status');
		} catch (err) {
			await setResyncStatus('An error occurred');
		}
	}
}));

export default app;

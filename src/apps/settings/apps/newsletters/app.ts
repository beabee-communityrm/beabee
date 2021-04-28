import express from 'express';
import moment from 'moment';
import { createQueryBuilder } from 'typeorm';

import { isSuperAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';
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
		await setResyncStatus('Uploading contacts to newsletter list');

		req.flash('success', 'newsletter-resync-started');
		res.redirect(req.originalUrl);

		try {
			const members = await createQueryBuilder(Member).limit(100).getMany();
			await NewsletterService.upsertMembers(members);

			await setResyncStatus('Importing contacts from newsletter list');

			const newsletterMembers = await NewsletterService.getNewsletterMembers();
			const missingNewsletterMembers = newsletterMembers.filter(nm => members.every(m => nm.email !== m.email));

			//await MembersService.createMember({}, {})

			await OptionsService.reset('newsletter-resync-status');
		} catch (err) {
			await setResyncStatus('An error occurred');
		}
	}
}));

export default app;

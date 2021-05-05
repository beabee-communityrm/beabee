import express from 'express';
import moment from 'moment';
import { createQueryBuilder } from 'typeorm';

import { log as mainLogger } from '@core/logging';
import { isSuperAdmin } from '@core/middleware';
import { ContributionType, wrapAsync } from '@core/utils';

import NewsletterService from '@core/services/NewsletterService';
import OptionsService from '@core/services/OptionsService';

import Member from '@models/Member';

import config from '@config';
import MembersService from '@core/services/MembersService';

const log = mainLogger.child({app: 'newsletter-settings'});

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index', {provider: config.newsletter.provider});
});

async function setResyncStatus(message: string) {
	await OptionsService.set('newsletter-resync-status', `[${moment.utc().format('HH:mm DD/MM')}] ${message}`);
}

app.post('/', wrapAsync(async (req, res) => {
	if (req.body.action === 'resync') {
		await setResyncStatus('In progress: Uploading contacts to newsletter list');

		req.flash('success', 'newsletter-resync-started');
		res.redirect(req.originalUrl);

		try {
			const members = await createQueryBuilder(Member).limit(100).getMany();
			await NewsletterService.upsertMembers(members);

			await setResyncStatus('In progress: Importing contacts from newsletter list');

			const newsletterMembers = await NewsletterService.getNewsletterMembers();
			const missingNewsletterMembers = newsletterMembers.filter(nm => members.every(m => nm.email !== m.email));
			console.log(missingNewsletterMembers.map(nm => nm.email));

			for (const missingNewsletterMember of missingNewsletterMembers) {
				await MembersService.createMember({
					email: missingNewsletterMember.email,
					firstname: missingNewsletterMember.firstname,
					lastname: missingNewsletterMember.lastname,
					contributionType: ContributionType.None
				}, undefined, {noSync: true});
			}

			await setResyncStatus('Successfully synced');
		} catch (error) {
			log.error({
				action: 'newsletter-sync-error',
				error
			}, 'Newsletter sync failed');
			await setResyncStatus('Error: ' + error.message);
		}
	}
}));

export default app;

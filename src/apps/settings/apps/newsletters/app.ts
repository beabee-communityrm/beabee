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

		await setResyncStatus('In progress: Fetching newsletter list');

		req.flash('success', 'newsletter-resync-started');
		res.redirect(req.originalUrl);

		try {
			const newsletterMembers = await NewsletterService.getNewsletterMembers();

			await setResyncStatus('In progress: Uploading contacts to newsletter list');

			// Resync all as it also updates their metadata
			const members = await MembersService.find();
			await NewsletterService.upsertMembers(members);

			await setResyncStatus('In progress: Importing contacts from newsletter list');

			const onlyNewsletterMembers = newsletterMembers.filter(nm => members.every(m => nm.email !== m.email));

			for (const nlMember of onlyNewsletterMembers) {
				await MembersService.createMember({
					email: nlMember.email,
					firstname: nlMember.firstname,
					lastname: nlMember.lastname,
					contributionType: ContributionType.None
				}, undefined, {noSync: true});
			}

			const onlyMembersCount = members.reduce(
				(count, m) => count + (newsletterMembers.every(nm => nm.email != m.email) ? 1 : 0),
				0
			);

			await setResyncStatus(`Successfully synced all contacts, ${onlyNewsletterMembers.length} imported and ${onlyMembersCount} newly uploaded`);
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

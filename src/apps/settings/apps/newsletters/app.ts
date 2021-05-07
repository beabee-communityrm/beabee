import express from 'express';
import moment from 'moment';

import { log as mainLogger } from '@core/logging';
import { isSuperAdmin } from '@core/middleware';
import { ContributionType, wrapAsync } from '@core/utils';

import NewsletterService from '@core/services/NewsletterService';
import OptionsService from '@core/services/OptionsService';

import config from '@config';
import MembersService from '@core/services/MembersService';
import { NewsletterStatus } from '@core/providers/newsletter';

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

		await setResyncStatus('In progress: Fetching contact lists');

		req.flash('success', 'newsletter-resync-started');
		res.redirect(req.originalUrl);

		try {
			const members = await MembersService.find({relations: ['profile']});
			const newsletterMembers = await NewsletterService.getNewsletterMembers();

			const newMembersToUpload = [], existingMembers = [], existingMembersToArchive = [];
			for (const member of members) {
				if (newsletterMembers.find(nm => nm.email === member.email)) {
					existingMembers.push(member);
					if (member.profile?.newsletterStatus === NewsletterStatus.Unsubscribed) {
						existingMembersToArchive.push(member);
					}
				} else if (member.profile?.newsletterStatus !== NewsletterStatus.Unsubscribed) {
					newMembersToUpload.push(member);
				}
			}
			const newsletterMembersToImport = newsletterMembers.filter(nm => members.every(m => m.email !== nm.email));

			await setResyncStatus('In progress: Uploading contacts to newsletter list');
			await NewsletterService.upsertMembers([...newMembersToUpload, ...existingMembers]);

			await setResyncStatus('In progress: Removing unsubscribed contacts from newsletter list');
			await NewsletterService.archiveMembers(existingMembersToArchive);

			await setResyncStatus('In progress: Importing contacts from newsletter list');

			for (const nlMember of newsletterMembersToImport) {
				await MembersService.createMember({
					email: nlMember.email,
					firstname: nlMember.firstname,
					lastname: nlMember.lastname,
					contributionType: ContributionType.None
				}, {
					newsletterStatus: nlMember.status,
					newsletterGroups: nlMember.groups
				}, {noSync: true});
			}

			await setResyncStatus(`Successfully synced all contacts, ${newsletterMembersToImport.length} imported and ${newMembersToUpload.length} newly uploaded`);
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

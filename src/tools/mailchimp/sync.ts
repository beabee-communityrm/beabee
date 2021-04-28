import 'module-alias/register';

import moment from 'moment';
import { Between, getRepository } from 'typeorm';

import * as db from '@core/database';

import NewsletterService from '@core/services/NewsletterService';
import OptionsService from '@core/services/OptionsService';

import Member from '@models/Member';
import MemberPermission from '@models/MemberPermission';

async function fetchMembers(startDate: string|undefined, endDate: string|undefined): Promise<Member[]> {
	const actualStartDate = startDate ? moment(startDate).toDate() : moment().subtract({d: 1, h: 2}).toDate();
	const actualEndDate = moment(endDate).toDate();

	console.log('Start date:', actualStartDate.toISOString());
	console.log('End date:', actualEndDate.toISOString());

	console.log('# Fetching members');

	const memberships = await getRepository(MemberPermission).find({
		where: {permission: 'member', dateExpires: Between(actualStartDate, actualEndDate)},
		relations: ['member']
	});
	console.log(`Got ${memberships.length} members`);
	return memberships.map(({member}) => {
		console.log(member.isActiveMember ? 'U' : 'D', member.email);
		return member;
	});
}

async function processMembers(members: Member[]) {
	const membersToArchive = members.filter(m => !m.isActiveMember);
	console.log(`Archiving ${membersToArchive.length}`);
	await NewsletterService.removeTagFromMembers(membersToArchive, OptionsService.getText('newsletter-active-member-tag'));
}

db.connect().then(async () => {
	const isTest = process.argv[2] === '-n';
	try {
		const [startDate, endDate] = process.argv.slice(isTest ? 3 : 2);
		const members = await fetchMembers(startDate, endDate);
		if (!isTest) {
			await processMembers(members);
		}
	} catch (err) {
		console.error(err);
	}
	await db.close();
});

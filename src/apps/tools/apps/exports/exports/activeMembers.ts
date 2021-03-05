import { getRepository, In, IsNull, MoreThan, Not } from 'typeorm';

import { Members } from '@core/database';
import { Param } from '@core/utils/params';

import Export from '@models/Export';
import GCPaymentData from '@models/GCPaymentData';
import { Member } from '@models/members';
import MemberPermission from '@models/MemberPermission';

import { ExportType } from './type';

async function getParams(): Promise<Param[]> {
	return [{
		name: 'hasActiveSubscription',
		label: 'Has active subscription',
		type: 'boolean'
	}];
}

async function getQuery({params}: Export): Promise<any> {
	const memberPermissions = await getRepository(MemberPermission).find({
		permission: 'member', dateExpires: MoreThan(new Date())
	});

	const members: {memberId: string}[] = params?.hasActiveSubscription ?
		await getRepository(GCPaymentData).find({
			memberId: In(memberPermissions.map(p => p.memberId)),
			subscriptionId: Not(IsNull())
		}) : memberPermissions;

	return {
		_id: {$in: members.map(m => m.memberId)}
	};
}

async function getExport(members: Member[]): Promise<Record<string, any>[]> {
	return members
		.map(member => ({
			Id: member.uuid,
			EmailAddress: member.email,
			FirstName: member.firstname,
			LastName: member.lastname,
			ReferralLink: member.referralLink,
			PollsCode: member.pollsCode,
			ContributionType: member.contributionType,
			ContributionMonthlyAmount: member.contributionMonthlyAmount,
			ContributionPeriod: member.contributionPeriod,
			ContributionDescription: member.contributionDescription
		}))
		.sort((a, b) => a.EmailAddress < b.EmailAddress ? -1 : 1);
}

export default {
	name: 'Active members export',
	statuses: ['added', 'seen'],
	collection: Members,
	itemName: 'active members',
	getParams,
	getQuery,
	getExport
} as ExportType<Member>;

import { Brackets, createQueryBuilder, getRepository, SelectQueryBuilder } from 'typeorm';

import { Param } from '@core/utils/params';

import Export from '@models/Export';
import GCPaymentData from '@models/GCPaymentData';
import Member from '@models/Member';
import MemberPermission from '@models/MemberPermission';

import type { ExportType } from '../app';
import ExportItem from '@models/ExportItem';

async function getParams(): Promise<Param[]> {
	return [{
		name: 'hasActiveSubscription',
		label: 'Has active subscription',
		type: 'boolean'
	}];
}

async function getItemsById(ids: string[]): Promise<Member[]> {
	return getRepository(Member).findByIds(ids);
}

function getQuery({params}: Export, items: ExportItem[]): SelectQueryBuilder<MemberPermission> {
	const now = new Date();
	const memberships = createQueryBuilder(MemberPermission, 'mp')
		.innerJoinAndSelect(Member, 'm')
		.where('mp.permission = \'member\' AND mp.dateAdded <= :now')
		.andWhere(new Brackets(qb => {
			qb.where('mp.dateExpires IS NULL')
				.orWhere('mp.dateExpires > :now');
		}))
		.andWhere('m.id NOT IN (:...ids)')
		.setParameters({now, ids: items.map(item => item.itemId)});

	if (params?.hasActiveSubscription) {
		memberships
			.innerJoin(GCPaymentData, 'gc', 'gc.memberId = m.memberId')
			.andWhere('gc.subscriptionId IS NOT NULL');
	}

	return memberships;
}

async function getEligibleItems(ex: Export, items: ExportItem[]): Promise<Member[]> {
	return (await getQuery(ex, items).getMany()).map(m => m.member);
}

async function getEligibleItemIds(ex: Export, items: ExportItem[]): Promise<string[]> {
	return (await getQuery(ex, items).select('m.id').getMany()).map(m => m.member.id);
}

async function getExport(members: Member[]): Promise<Record<string, any>[]> {
	return members
		.map(member => ({
			Id: member.id,
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
	itemName: 'active members',
	getParams,
	getItemsById,
	getNewItems: getEligibleItems,
	getNewItemIds: getEligibleItemIds,
	getExport
} as ExportType<Member>;

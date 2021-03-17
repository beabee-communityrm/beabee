import { Brackets, createQueryBuilder, SelectQueryBuilder } from 'typeorm';

import { Param } from '@core/utils/params';

import GCPaymentData from '@models/GCPaymentData';
import Member from '@models/Member';

import BaseExport, { ExportResult } from './BaseExport';

export default class ActiveMembersExport extends BaseExport<Member> {
	exportName = 'Active members export'
	itemStatuses = ['added', 'seeen']
	itemName = 'active members'
	idColumn = 'm.id'

	async getParams(): Promise<Param[]> {
		return [{
			name: 'hasActiveSubscription',
			label: 'Has active subscription',
			type: 'boolean'
		}];
	}

	protected getQuery(): SelectQueryBuilder<Member> {
		const members = createQueryBuilder(Member, 'm')
			.innerJoin('m.permissions', 'mp')
			.where('mp.permission = \'member\' AND mp.dateAdded <= :now')
			.andWhere(new Brackets(qb => {
				qb.where('mp.dateExpires IS NULL')
					.orWhere('mp.dateExpires > :now', {now: new Date()});
			}));

		if (this.ex!.params?.hasActiveSubscription) {
			members
				.innerJoin(GCPaymentData, 'gc', 'gc.memberId = m.memberId')
				.andWhere('gc.subscriptionId IS NOT NULL');
		}

		return members;
	}

	async getExport(members: Member[]): Promise<ExportResult> {
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
}

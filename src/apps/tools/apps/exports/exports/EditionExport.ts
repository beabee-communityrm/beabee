import _ from 'lodash';
import { Brackets, createQueryBuilder, SelectQueryBuilder } from 'typeorm';

import { ContributionType } from '@core/utils';
import { Param } from '@core/utils/params';

import ExportItem from '@models/ExportItem';
import Member from '@models/Member';

import BaseExport, { ExportResult } from './BaseExport';

export default class EditionExport extends BaseExport<Member> {
	exportName = 'Edition export'
	itemStatuses = ['added', 'sent']
	itemName = 'members'
	idColumn = 'm.id'

	async getParams(): Promise<Param[]> {
		return [{
			name: 'monthlyAmountThreshold',
			label: 'Monthly contribution amount threshold',
			type: 'number'
		}, {
			name: 'includeNonOptIn',
			label: 'Include those without delivery opt in',
			type: 'boolean'
		}];
	}

	protected getQuery(): SelectQueryBuilder<Member> {
		const members = createQueryBuilder(Member, 'm')
			.innerJoinAndSelect('m.profile', 'profile')
			.innerJoin('m.permissions', 'mp')
			.where('mp.permission = \'member\' AND mp.dateAdded <= :now')
			.andWhere(new Brackets(qb => {
				qb.where('mp.dateExpires IS NULL')
					.orWhere('mp.dateExpires > :now');
			}))
			.andWhere('m.contributionMonthlyAmount >= :amount')
			.setParameters({
				now: new Date(),
				amount: this.ex!.params?.monthlyAmountThreshold || 3
			});

		if (!this.ex!.params?.includeNonOptIn) {
			members
				.andWhere('profile.deliveryOptIn = TRUE');
		}

		return members;
	}

	async getExport(members: Member[]): Promise<ExportResult> {
		const editionExportItems = await createQueryBuilder(ExportItem, 'ei')
			.innerJoin('ei.export', 'e')
			.where('e.type = \'edition\'')
			.orderBy('e.date', 'ASC')
			.loadAllRelationIds()
			.getMany() as unknown as WithRelationIds<ExportItem, 'export'>[];

		// Get list of edition export IDs
		const editionExportIdsByDate = editionExportItems.filter((ei, i, arr) => arr.indexOf(ei) === i).map(ei => ei.export);

		function getExportNo(id: string) {
			const i = editionExportIdsByDate.indexOf(id);
			return i > -1 ? i : editionExportIdsByDate.length;
		}

		const currentExportNo = getExportNo(this.ex!.id);

		const editionExportItemsByMemberId = _.groupBy(editionExportItems, 'itemId');

		return members
			.map(member => {
				const deliveryAddress = member.profile?.deliveryAddress || {line1: '', line2: '', city: '', postcode: ''};
				const memberExportItems = editionExportItemsByMemberId[member.id] || [];

				return {
					EmailAddress: member.email,
					FirstName: member.firstname,
					LastName: member.lastname,
					Address1: deliveryAddress.line1,
					Address2: deliveryAddress.line2,
					City: deliveryAddress.city,
					Postcode: deliveryAddress.postcode.trim().toUpperCase(),
					ReferralLink: member.referralLink,
					IsGift: member.contributionType === ContributionType.Gift,
					IsFirstEdition: memberExportItems.every(ei => getExportNo(ei.export) >= currentExportNo),
					//NumCopies: member.delivery_copies === undefined ? 2 : member.delivery_copies,
					ContributionMonthlyAmount: member.contributionMonthlyAmount
				};
			})
			.sort((a, b) => b.LastName.toLowerCase() > a.LastName.toLowerCase() ? -1 : 1);
	}
}

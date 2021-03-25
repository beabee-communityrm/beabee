import _ from 'lodash';
import { createQueryBuilder, SelectQueryBuilder } from 'typeorm';

import { ContributionType } from '@core/utils';
import { Param } from '@core/utils/params';

import ExportItem from '@models/ExportItem';
import Member from '@models/Member';

import { ExportResult } from './BaseExport';
import ActiveMembersExport from './ActiveMembersExport';

export default class EditionExport extends ActiveMembersExport {
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

	protected get query(): SelectQueryBuilder<Member> {
		return createQueryBuilder(Member, 'm')
			.innerJoinAndSelect('m.profile', 'profile')
			.orderBy({
				firstname: 'ASC',
				lastname: 'ASC'
			});
	}

	protected getNewItemsQuery(): SelectQueryBuilder<Member> {
		const query = super.getNewItemsQuery()
			.andWhere('m.contributionMonthlyAmount >= :amount')
			.setParameters({
				now: new Date(),
				amount: this.ex!.params?.monthlyAmountThreshold || 3
			});

		if (!this.ex!.params?.includeNonOptIn) {
			query.andWhere('profile.deliveryOptIn = TRUE');
		}

		return query;
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
			});
	}
}

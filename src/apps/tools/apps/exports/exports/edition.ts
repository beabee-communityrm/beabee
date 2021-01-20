import _ from 'lodash';

import { Members, Permissions } from '@core/database';
import config from  '@config' ;
import { Param } from '@core/utils/params.js';

import Export from '@models/Export';
import { Member } from '@models/members';
import { ExportType } from './type';
import { getRepository } from 'typeorm';

async function getParams(): Promise<Param[]> {
	return [{
		name: 'monthlyAmountThreshold',
		label: 'Monthly contribution amount threshold',
		type: 'number'
	}];
}

async function getQuery({params}: Export) {
	const permission = await Permissions.findOne( { slug: config.permission.member });
	return {
		// TODO: switch this to contributionMonthlyAmount
		'gocardless.amount': {
			$gte: params?.monthlyAmountThreshold === undefined ? 3 : params?.monthlyAmountThreshold
		},
		permissions: {$elemMatch: {
			permission,
			date_expires: {$gte: new Date()}
		}},
		delivery_optin: true
	};
}

async function getExport(members: Member[], {id: exportId}: Export) {
	const exportIds =
		(await getRepository(Export).find({where: {type: 'edition'}, order: {date: 'ASC'}})).map(e => e.id);

	function getExportNo(id: string) {
		const i = exportIds.findIndex(id2 => id === id2);
		return i > -1 ? i : exportIds.length;
	}

	const currentExportNo = getExportNo(exportId);

	return members
		.map(member => {
			const postcode = (member.delivery_address.postcode || '').trim().toUpperCase();
			return {
				FirstName: member.firstname,
				LastName: member.lastname,
				Address1: member.delivery_address.line1,
				Address2: member.delivery_address.line2,
				City: member.delivery_address.city,
				Postcode: postcode,
				ReferralLink: member.referralLink,
				IsGift: member.contributionPeriod === 'gift',
				// TODO: IsFirstEdition: _.every(member.exports, e => getExportNo(e.export_id) >= currentExportNo),
				NumCopies: member.delivery_copies === undefined ? 2 : member.delivery_copies,
				ContributionMonthlyAmount: member.contributionMonthlyAmount
			};
		})
		.sort((a, b) => b.LastName.toLowerCase() > a.LastName.toLowerCase() ? -1 : 1);
}

export default {
	name: 'Edition export',
	statuses: ['added', 'sent'],
	collection: Members,
	itemName: 'members',
	getParams,
	getQuery,
	getExport
} as ExportType<Member>;

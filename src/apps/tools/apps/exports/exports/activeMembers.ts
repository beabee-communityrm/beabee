import { Members, Permissions } from '@core/database';
import { Param } from '@core/utils/params';

import config from '@config' ;
import Export from '@models/Export';
import { Member } from '@models/members';
import { ExportType } from './type';

async function getParams(): Promise<Param[]> {
	return [{
		name: 'hasActiveSubscription',
		label: 'Has active subscription',
		type: 'boolean'
	}];
}

async function getQuery({params}: Export): Promise<any> {
	const permission = await Permissions.findOne( { slug: config.permission.member });
	return {
		permissions: {$elemMatch: {
			permission,
			date_expires: {$gte: new Date()}
		}},
		...(params?.hasActiveSubscription ? {'gocardless.subscription_id': {$exists: true, $ne: ''}} : {})
	};
}

function anonymisePostcode(postcode: string): string {
	return postcode &&
		(postcode[0] + postcode.substr(1, postcode.length - 3).replace(/[A-Za-z0-9]/g, '•') + postcode.substr(-2));
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
			ContributionMonthlyAmount: member.contributionMonthlyAmount,
			ContributionPeriod: member.contributionPeriod,
			ContributionDescription: member.contributionDescription,
			ContributionPayingFee: member.gocardless.paying_fee,
			Postcode: member.delivery_optin ? anonymisePostcode(member.delivery_address.postcode!) : ''
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

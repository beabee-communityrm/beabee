import { Members } from '@core/database';
import GCPaymentData from '@models/GCPaymentData';
import { Member } from '@models/members';
import { getRepository } from 'typeorm';
import { ExportType } from './type';

async function getQuery() {
	return {};
}

async function getExport(members: Member[]) {
	const gcPaymentTypes = await getRepository(GCPaymentData).find();

	return members
		.map(member => {
			const gc = gcPaymentTypes.find(gc => gc.memberId === member.id);
			return {
				Id: member.uuid,
				EmailAddress: member.email,
				FirstName: member.firstname,
				LastName: member.lastname,
				Amount: member.contributionMonthlyAmount,
				Period: member.contributionPeriod,
				NextAmount: member.nextContributionMonthlyAmount,
				...(gc && {
					CustomerId: gc.customerId,
					MandateId: gc.mandateId,
					SubscriptionId: gc.subscriptionId,
					PayFee: gc.payFee,
					CancelledAt: gc.cancelledAt,
				})
			};
		})
		.sort((a, b) => a.EmailAddress < b.EmailAddress ? -1 : 1);
}

export default {
	name: 'GoCardless details export',
	statuses: ['added', 'seen'],
	collection: Members,
	itemName: 'members',
	getQuery,
	getExport
} as ExportType<Member>;

const { Members } = require(__js + '/database');

async function getQuery() {
	return {};
}

async function getExport(members) {
	return members
		.map(member => ({
			Id: member.uuid,
			EmailAddress: member.email,
			FirstName: member.firstname,
			LastName: member.lastname,
			CustomerId: member.gocardless.customer_id,
			MandateId: member.gocardless.mandate_id,
			SubscriptionId: member.gocardless.subscription_id,
			Amount: member.gocardless.amount,
			Period: member.gocardless.period,
			PayFee: member.gocardless.paying_fee,
			CancelledAt: member.gocardless.cancelled_at,
			NextAmount: member.gocardless.next_amount,
		}))
		.sort((a, b) => a.EmailAddress < b.EmailAddress ? -1 : 1);
}

module.exports = {
	name: 'GoCardless details export',
	statuses: ['added', 'seen'],
	collection: Members,
	itemName: 'members',
	getQuery,
	getExport
};

const { GiftFlows, Members } = require('@core/database');

async function getQuery() {
	return {
		completed: true
	};
}

async function getExport(giftFlows) {
	const members = await Members.find({
		giftCode: {$in: giftFlows.map(gf => gf.setupCode)}
	});

	const membersByGiftCode = _.keyBy(members, 'setupCode');

	return giftFlows.map(giftFlow => {
		const member = membersByGiftCode[giftFlow.setupCode];
		return {
			GiftDate: giftFlow.date,
			GifterName: giftFlow.giftForm.fromName,
			GifterEmail: giftFlow.giftForm.fromEmail,
			GifteeName: member.fullname,
			GifteeFirstName: member.firstname,
			GifteeEmail: member.email,
			GifteeExpiryDate: member.memberPermission.date_expires.toISOString(),
			GifteeHasConverted: member.contributionPeriod !== 'gift'
		};
	});
}

module.exports = {
	name: 'Gifts export',
	statuses: ['added', 'seen', 'sent'],
	collection: GiftFlows,
	itemName: 'gifts',
	getQuery,
	getExport
};

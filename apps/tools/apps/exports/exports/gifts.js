const _ = require('lodash');
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

	const membersByCode = _.keyBy(members, 'giftCode');

	return giftFlows.map(giftFlow => {
		const member = membersByCode[giftFlow.setupCode];
		return {
			GiftPurchaseDate: giftFlow.date.toISOString(),
			GiftStartDate: giftFlow.giftForm.startDate.toISOString(),
			GifterName: giftFlow.giftForm.fromName,
			GifterEmail: giftFlow.giftForm.fromEmail,
			...(member && {
				GifteeName: member.fullname,
				GifteeFirstName: member.firstname,
				GifteeEmail: member.email,
				GifteeExpiryDate: member.memberPermission.date_expires.toISOString(),
				GifteeHasConverted: member.contributionPeriod !== 'gift',
				GifteeAddress1: member.delivery_address.line1,
				GifteeAddress2: member.delivery_address.line2,
				GifteeCity: member.delivery_address.city,
				GifteePostcode: (member.delivery_address.postcode || '').trim().toUpperCase()
			})
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

const _ = require('lodash');
const { GiftFlows, Members } = require('@core/database');

async function getQuery() {
	return {
		completed: true
	};
}

function addressFields(address={}) {
	return {
		GifteeAddress1: address.line1,
		GifteeAddress2: address.line2,
		GifteeCity: address.city,
		GifteePostcode: (address.postcode || '').trim().toUpperCase(),
	};
}

async function getExport(giftFlows) {
	const members = await Members.find({
		giftCode: {$in: giftFlows.map(gf => gf.setupCode)}
	});

	const membersByCode = _.keyBy(members, 'giftCode');

	return giftFlows.map(({date, giftForm, setupCode}) => {
		const member = membersByCode[setupCode];

		const gifteeDetails = member ? {
			GifteeName: member.fullname,
			GifteeFirstName: member.firstname,
			GifteeEmail: member.email,
			GifteeExpiryDate: member.membershipExpires.toISOString(),
			GifteeHasActivated: !member.password.hash,
			GifteeHasConverted: member.contributionPeriod !== 'gift',
			...addressFields(member.delivery_address)
		} : {
			GifteeName: giftForm.firstname + ' ' + giftForm.lastname,
			GifteeFirstName: giftForm.firstname,
			GifteeEmail: giftForm.email,
			GifteeExpiryDate: '',
			GifteeHasActivated: false,
			GifteeHasConverted: false,
			...addressFields(giftForm.delivery_address)
		};

		return {
			GiftPurchaseDate: date.toISOString(),
			GiftStartDate: giftForm.startDate.toISOString(),
			GiftCode: setupCode,
			GiftHasStarted: !!member,
			GifterName: giftForm.fromName,
			GifterEmail: giftForm.fromEmail,
			Message: giftForm.message,
			...gifteeDetails
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

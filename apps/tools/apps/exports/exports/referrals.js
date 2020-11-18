const { Members, Referrals } = require('@core/database');

async function getQuery() {
	return {};
}

function memberDetails(member) {
	return member ? [
		member.email,
		member.firstname,
		member.lastname,
		...member.delivery_optin ? [
			member.delivery_address.line1,
			member.delivery_address.line2,
			member.delivery_address.city,
			member.delivery_address.postcode
		] : ['', '', '', '']
	] : ['', '', '', '', '', '', ''];
}

async function getExport(referrals) {
	const members = await Members.find();
	const membersById = {};
	members.forEach(member => membersById[member._id] = member);

	const giftOptions = referrals
		.map(referral => [
			...Object.keys(referral.referrerGiftOptions || {}),
			...Object.keys(referral.refereeGiftOptions || {})
		])
		.reduce((a, b) => [...a, ...b], [])
		.filter((opt, i, arr) => arr.indexOf(opt) === i); // deduplicate

	const fields = [
		'Date',
		'Type',
		'Email',
		'FirstName',
		'LastName',
		'Address1',
		'Address2',
		'City',
		'Postcode',
		'RefereeAmount',
		'Gift',
		...giftOptions
	];

	const data = referrals
		.map(referral => {
			const referrer = membersById[referral.referrer];
			const referee = membersById[referral.referee];

			return [[
				referral.date,
				'Referrer',
				...memberDetails(referrer),
				referral.refereeAmount,
				referral.referrerGift,
				...giftOptions.map(opt => (referral.referrerGiftOptions || {[opt]: ''})[opt])
			], [
				referral.date,
				'Referee',
				...memberDetails(referee),
				referral.refereeAmount,
				referral.refereeGift,
				...giftOptions.map(opt => (referral.refereeGiftOptions || {[opt]: ''})[opt])
			]];
		})
		.reduce((a, b) => [...a, ...b], []);

	return {fields, data};
}

module.exports = {
	name: 'Referrals export',
	statuses: ['added', 'seen'],
	collection: Referrals,
	itemName: 'referrals',
	getQuery,
	getExport
};

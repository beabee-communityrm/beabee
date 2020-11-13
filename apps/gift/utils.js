const moment = require( 'moment' );

const mandrill = require( __js + '/mandrill' );
const { default: MembersService } = require( '@core/services/MembersService' );

async function processGiftFlow( giftFlow, sendImmediately = false ) {
	const { firstname, lastname, email, delivery_address = {}, type, fromName,
		message } = giftFlow.giftForm;
	const now = moment.utc();

	if (giftFlow.processed) return;

	await giftFlow.update({$set: {processed: true}});

	const member = await MembersService.createMember({
		firstname,
		lastname,
		email,
		delivery_address,
		delivery_optin: !!delivery_address.line1,
		gocardless: {
			amount: 3,
			period: 'gift'
		},
		giftCode: giftFlow.setupCode
	});

	member.memberPermission = {
		date_added: now.toDate(),
		date_expires: now.clone().add(type === '6' ? 6 : 12, 'months').toDate()
	};
	await member.save();

	const sendAt = sendImmediately ? null : now.clone().set({h: 10, m: 0, s: 0}).format();
	await mandrill.sendToMember('giftee-success', member, { fromName, message }, sendAt);

	await MembersService.addMemberToMailingLists(member);
}

module.exports = {
	processGiftFlow
};

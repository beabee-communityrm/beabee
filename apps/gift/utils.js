const moment = require( 'moment' );

const mandrill = require( __js + '/mandrill' );
const { createMember, addToMailingLists } = require( __apps + '/join/utils' );

async function processGiftFlow( giftFlow, sendImmediately = false ) {
	const { firstname, lastname, email, delivery_address = {}, type, fromName,
		message } = giftFlow.giftForm;
	const now = moment();

	if (giftFlow.processed) return;

	await giftFlow.update({$set: {processed: true}});

	const member = await createMember({
		firstname,
		lastname,
		email,
		delivery_address,
		delivery_optin: !!delivery_address.line1,
		gocardless: {
			amount: 3,
			period: 'gift'
		}
	});

	member.memberPermission = {
		date_added: now.toDate(),
		date_expires: now.clone().add(type === '6' ? 6 : 12, 'months').toDate()
	};
	member.giftCode = giftFlow.setupCode;
	await member.save();

	const sendAt = sendImmediately ? null : now.clone().set({h: 10, m: 0, s: 0}).format();
	await mandrill.sendToMember('giftee-success', member, { fromName, message }, sendAt);

	await addToMailingLists(member);
}

module.exports = {
	processGiftFlow
};

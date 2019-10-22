const moment = require( 'moment' );

const { createMember } = require( __apps + '/join/utils' );

async function processGift( gift ) {
	const { firstname, lastname, delivery_address = {}, type } = gift.giftForm;

	const member = await createMember({
		firstname,
		lastname,
		delivery_address,
		delivery_optin: !!delivery_address.line1
	});

	member.memberPermission = {
		date_added: new Date(),
		date_expires: moment.utc().add(type === '6' ? 6 : 12, 'months').toDate()
	};
	member.giftCode = gift.setupCode;
	await member.save();

	await gift.update({$set: {processed: true}});
}

module.exports = {
	processGift
};

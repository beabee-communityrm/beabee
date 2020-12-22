import moment  from 'moment';

import mandrill from '@core/mandrill';
import MembersService from '@core/services/MembersService';
import { GiftFlow } from '@models/gift-flows';
import { ContributionPeriod } from '@core/utils';

export async function processGiftFlow(giftFlow: GiftFlow, sendImmediately = false): Promise<void> {
	const {
		firstname, lastname, email, delivery_copies_address, type, fromName, message
	} = giftFlow.giftForm;
	const now = moment.utc();

	if (giftFlow.processed) return;

	await giftFlow.update({$set: {processed: true}});

	const member = await MembersService.createMember({
		firstname,
		lastname,
		email,
		delivery_address: delivery_copies_address,
		delivery_optin: !!delivery_copies_address.line1
	});

	member.giftCode = giftFlow.setupCode;

	member.gocardless = {
		amount: 3,
		period: ContributionPeriod.Gift
	};

	member.memberPermission = {
		date_added: now.toDate(),
		date_expires: now.clone().add(type === '6' ? 6 : 12, 'months').toDate()
	};
	await member.save();

	const isBeforeCutoff = moment.utc(giftFlow.date).isBefore('2020-12-17');
	const sendAt = sendImmediately ? null : now.clone().startOf('day').add({
		d: isBeforeCutoff ? 1 : 0, // Delay email by a day if they are receiving a physical gift
		h: 9, m: 0, s: 0
	}).format();
	await mandrill.sendToMember('giftee-success', member, { fromName, message }, sendAt);

	await MembersService.addMemberToMailingLists(member);
}

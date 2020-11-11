import moment from 'moment';

import { log } from '@core/logging';
import { Members } from  '@core/database';
import mailchimp from '@core/mailchimp';

import PaymentService from '@core/services/PaymentService';
import ReferralsService from '@core/services/ReferralsService';

import config from '@config';
import { JoinForm } from '@models/join-flows';
import { Member, PartialMember } from '@models/members';

export default class MembersService {
	static generateMemberCode(member: PartialMember): string {
		const no = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
		return (member.firstname[0] + member.lastname[0] + no).toUpperCase();
	}

	static async createMember(memberObj: PartialMember): Promise<Member> {
		try {
			return <Member>await Members.create({
				...memberObj,
				referralCode: MembersService.generateMemberCode(memberObj),
				pollsCode: MembersService.generateMemberCode(memberObj)
			});
		} catch (saveError) {
			const {code, message} = saveError;
			if (code === 11000 && (message.indexOf('referralCode') > -1 || message.indexOf('pollsCode') > -1)) {
				// Retry with a different referral code
				return await MembersService.createMember(memberObj);
			}
			throw saveError;
		}
	}

	static async addMemberToMailingLists(member: Member): Promise<void> {
		try {
			await mailchimp.mainList.addMember(member);
		} catch (err) {
			log.error({
				app: 'join-utils',
				error: err,
			}, 'Adding member to MailChimp failed, probably a bad email address: ' + member.uuid);
		}
	}

	static async startMembership(member: Member, joinForm: JoinForm): Promise<void> {
		if (member.isActiveMember || member.hasActiveSubscription) {
			throw new Error('Tried to create subscription on member with active subscription');
		} else {
			const subscription = await PaymentService.createSubscription(
				joinForm.amount, joinForm.period, joinForm.payFee, member.gocardless.mandate_id
			);

			member.gocardless.subscription_id = subscription.id;
			member.gocardless.amount = joinForm.amount;
			member.gocardless.period = joinForm.period;
			member.gocardless.paying_fee = joinForm.payFee;
			member.memberPermission = {
				date_added: new Date(),
				date_expires: moment.utc(subscription.upcoming_payments[0].charge_date).add(config.gracePeriod).toDate()
			};
			await member.save();

			await MembersService.addMemberToMailingLists(member);

			if (joinForm.referralCode) {
				const referrer = <Member>await Members.findOne({referralCode: joinForm.referralCode});
				await ReferralsService.createReferral(referrer, member, joinForm);
			}
		}
	}
}
const moment = require('moment');

const { log } = require( __js + '/logging' );
const { Members } = require( __js + '/database' );
const mailchimp = require( __js + '/mailchimp' );

const PaymentService = require( __js + '/services/PaymentService' );
const ReferralsService = require( __js + '/services/ReferralsService' );

const config = require( __config );

class MembersService {
	static generateMemberCode({firstname, lastname}) {
		const no = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
		return (firstname[0] + lastname[0] + no).toUpperCase();
	}

	static async createMember(memberObj) {
		try {
			return await Members.create({
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

	static async addMemberToMailingLists(member) {
		try {
			await mailchimp.mainList.addMember(member);
		} catch (err) {
			log.error({
				app: 'join-utils',
				error: err,
			}, 'Adding member to MailChimp failed, probably a bad email address: ' + member.uuid);
		}
	}

	static async startMembership(member, {
		amount, period, referralCode, referralGift, referralGiftOptions, payFee
	}) {
		if (member.isActiveMember || member.hasActiveSubscription) {
			throw new Error('Tried to create subscription on member with active subscription');
		} else {
			const subscription = await PaymentService.createSubscription(amount, period, payFee, member.gocardless.mandate_id);

			member.gocardless.subscription_id = subscription.id;
			member.gocardless.amount = amount;
			member.gocardless.period = period;
			member.gocardless.paying_fee = payFee;
			member.memberPermission = {
				date_added: new Date(),
				date_expires: moment.utc(subscription.upcoming_payments[0].charge_date).add(config.gracePeriod).toDate()
			};
			await member.save();

			await MembersService.addMemberToMailingLists(member);

			if (referralCode) {
				const referrer = await Members.findOne({referralCode});
				await ReferralsService.createReferral({
					referrer,
					member,
					referralGift,
					referralGiftOptions,
					amount
				});

			}
		}
	}
}

module.exports = MembersService;

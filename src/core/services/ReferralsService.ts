import _ from 'lodash';

import { Referrals, ReferralGifts } from '@core/database';
import mandrill from '@core/mandrill';

import { JoinForm } from '@models/JoinFlow';
import { Member } from '@models/members';
import { ReferralGift } from '@models/referrals';

export default class ReferralsService {
	static async getGifts(): Promise<ReferralGift[]> {
		return <ReferralGift[]>await ReferralGifts.find();
	}

	static async isGiftAvailable({referralGift, referralGiftOptions, amount}: JoinForm): Promise<boolean> {
		if (!referralGift) return true; // No gift option

		const gift = <ReferralGift>await ReferralGifts.findOne({name: referralGift});
		if (gift && gift.enabled && gift.minAmount <= amount) {
			const stockRef = _.values(referralGiftOptions).join('/');
			return ReferralsService.hasStock(gift, stockRef);
		}
		return false;
	}

	static async updateGiftStock({referralGift, referralGiftOptions}: JoinForm): Promise<void> {
		const gift = <ReferralGift>await ReferralGifts.findOne({name: referralGift});
		if (gift) {
			const stockRef = _.values(referralGiftOptions).join('/');
			if (ReferralsService.hasStock(gift, stockRef)) {
				await gift.update({$inc: {['stock.' + stockRef]: -1}});
			}
		}
	}

	static async createReferral(referrer: Member|null, member: Member, joinForm: JoinForm): Promise<void> {
		await Referrals.create({
			referrer: referrer?._id,
			referee: member._id,
			refereeGift: joinForm.referralGift,
			refereeGiftOptions: joinForm.referralGiftOptions,
			refereeAmount: joinForm.amount
		});

		await ReferralsService.updateGiftStock(joinForm);

		await mandrill.sendToMember('successful-referral', referrer, {
			refereeName: member.firstname,
			isEligible: joinForm.amount >= 3
		});
	}

	private static hasStock(gift: ReferralGift, stockRef: string): boolean {
		const stock = gift.stock?.get(stockRef);
		return stock === undefined ? true : stock > 0;
	}
}

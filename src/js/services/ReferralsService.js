const _ = require('lodash');

const { Referrals, ReferralGifts } = require(__js + '/database');
const mandrill = require(__js + '/mandrill');

class ReferralsService {
	static async getGifts() {
		return await ReferralGifts.find();
	}

	static async isGiftAvailable({referralGift, referralGiftOptions, amount}) {
		if (!referralGift) return true; // No gift option

		const gift = await ReferralGifts.findOne({name: referralGift});
		if (gift && gift.enabled && gift.minAmount <= amount) {
			const stockRef = _.values(referralGiftOptions).join('/');
			return !gift.stock || gift.stock.get(stockRef) > 0;
		}
		return false;
	}

	static async updateGiftStock({referralGift, referralGiftOptions}) {
		const gift = await ReferralGifts.findOne({name: referralGift});
		if (gift) {
			const stockRef = _.values(referralGiftOptions).join('/');
			if (gift.stock && gift.stock.get(stockRef) > 0) {
				await gift.update({$inc: {['stock.' + stockRef]: -1}});
			}
		}
	}

	static async createReferral({referrer, member, referralGift, referralGiftOptions, amount}) {
		await Referrals.create({
			referrer: referrer._id,
			referee: member._id,
			refereeGift: referralGift,
			refereeGiftOptions: referralGiftOptions,
			refereeAmount: amount
		});

		await ReferralsService.updateGiftStock({referralGift, referralGiftOptions});

		await mandrill.sendToMember('successful-referral', referrer, {
			refereeName: member.firstname,
			isEligible: amount >= 3
		});
	}
}

module.exports = ReferralsService;

const _ = require('lodash');
const { ReferralGifts } = require(__js + '/database');

class GiftsService {
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
}

module.exports = GiftsService;

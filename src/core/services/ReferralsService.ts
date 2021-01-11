import _ from 'lodash';
import { Document } from 'mongoose';
import { getRepository } from 'typeorm';

import { Referrals } from '@core/database';
import { log as mainLogger } from '@core/logging';
import mandrill from '@core/mandrill';
import { ReferralGiftForm } from '@core/utils';

import { Member } from '@models/members';
import ReferralGift from '@models/ReferralGift';

const log = mainLogger.child({app: 'referrals-service'});

export default class ReferralsService {
	static async getGifts(): Promise<ReferralGift[]> {
		return await getRepository(ReferralGift).find();
	}

	static async isGiftAvailable(giftForm: ReferralGiftForm, amount: number): Promise<boolean> {
		if (!giftForm.referralGift) return true; // No gift option

		const gift = await getRepository(ReferralGift).findOne({name: giftForm.referralGift});
		if (gift && gift.enabled && gift.minAmount <= amount) {
			if (giftForm.referralGiftOptions) {
				const optionStockRef = Object.values(giftForm.referralGiftOptions).join('/');
				const optionStock = gift.stock.get(optionStockRef);
				return optionStock === undefined || optionStock > 0;
			} else {
				return true;
			}
		}

		return false;
	}

	static async updateGiftStock(giftForm: ReferralGiftForm): Promise<void> {
		log.info({
			'action': 'update-gift-stock',
			data: {
				giftForm
			}
		});

		const gift = await getRepository(ReferralGift).findOne({name: giftForm.referralGift});
		if (gift && giftForm.referralGiftOptions) {
			const optionStockRef = Object.values(giftForm.referralGiftOptions).join('/');
			const optionStock = gift.stock.get(optionStockRef);
			if (optionStock !== undefined) {
				// TODO: this update isn't atomic
				gift.stock.set(optionStockRef, optionStock - 1);
				getRepository(ReferralGift).update(gift.name, {stock: gift.stock});
			}
		}
	}

	static async createReferral(referrer: Member|null, referee: Member, giftForm: ReferralGiftForm): Promise<void> {
		log.info({
			'action': 'create-referral',
			data: {
				referrerId: referrer?._id,
				refereeId: referee.id,
				giftForm,
				refereeAmount: referee.contributionMonthlyAmount
			}
		});

		await Referrals.create({
			referrer: referrer?._id,
			referee: referee._id,
			refereeGift: giftForm.referralGift,
			refereeGiftOptions: giftForm.referralGiftOptions,
			refereeAmount: referee.contributionMonthlyAmount
		} as unknown as Document);

		await ReferralsService.updateGiftStock(giftForm);

		await mandrill.sendToMember('successful-referral', referrer, {
			refereeName: referee.firstname,
			isEligible: referee.contributionMonthlyAmount >= 3
		});
	}
}

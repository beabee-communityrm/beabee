import _ from 'lodash';

import { Referrals } from '@core/database';
import mandrill from '@core/mandrill';

import { JoinForm } from '@models/JoinFlow';
import { Member } from '@models/members';
import { Document } from 'mongoose';
import ReferralGift from '@models/ReferralGift';
import { createQueryBuilder, getRepository } from 'typeorm';

type GiftForm = Pick<JoinForm,'amount'|'referralGift'|'referralGiftOptions'>;

export default class ReferralsService {
	static async getGifts(): Promise<ReferralGift[]> {
		return await getRepository(ReferralGift).find();
	}

	static async isGiftAvailable({referralGift, referralGiftOptions, amount}: GiftForm): Promise<boolean> {
		if (!referralGift) return true; // No gift option

		const gift = await getRepository(ReferralGift).findOne({name: referralGift});
		if (gift && gift.enabled && gift.minAmount <= amount) {
			const stockRef = _.values(referralGiftOptions).join('/');
			return ReferralsService.hasStock(gift, stockRef);
		}
		return false;
	}

	static async updateGiftStock({referralGift, referralGiftOptions}: GiftForm): Promise<void> {
		const gift = await getRepository(ReferralGift).findOne({name: referralGift});
		if (gift && referralGiftOptions) {
			// Should never happen but remove any ' just in case to stop SQL injections
			const stockRef = Object.values(referralGiftOptions).join('/').replace(/'/g, '');

			if (ReferralsService.hasStock(gift, stockRef)) {
				// Ugly atomic decrement for JSONB type
				await createQueryBuilder().update(ReferralGift)
					.set({stock: () => `jsonb_set(stock, '{${stockRef}}', (coalesce(stock->>'${stockRef}', '0')::int - 1)::text::jsonb)`})
					.where('name = :name', {name: gift.name})
					.execute();
			}
		}
	}

	static async createReferral(referrer: Member|null, member: Member, giftForm: GiftForm): Promise<void> {
		await Referrals.create({
			referrer: referrer?._id,
			referee: member._id,
			refereeGift: giftForm.referralGift,
			refereeGiftOptions: giftForm.referralGiftOptions,
			refereeAmount: giftForm.amount
		} as unknown as Document);

		await ReferralsService.updateGiftStock(giftForm);

		await mandrill.sendToMember('successful-referral', referrer, {
			refereeName: member.firstname,
			isEligible: giftForm.amount >= 3
		});
	}

	private static hasStock(gift: ReferralGift, stockRef: string): boolean {
		const stock = gift.stock.get(stockRef);
		return stock === undefined ? true : stock > 0;
	}
}

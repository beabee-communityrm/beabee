import _ from "lodash";
import { getRepository } from "typeorm";

import { log as mainLogger } from "@core/logging";
import { ReferralGiftForm } from "@core/utils";

import EmailService from "@core/services/EmailService";

import Member from "@models/Member";
import ReferralGift from "@models/ReferralGift";
import Referral from "@models/Referral";

const log = mainLogger.child({ app: "referrals-service" });

export default class ReferralsService {
  static async getGifts(): Promise<ReferralGift[]> {
    return await getRepository(ReferralGift).find();
  }

  static async isGiftAvailable(
    giftForm: ReferralGiftForm,
    amount: number
  ): Promise<boolean> {
    if (!giftForm.referralGift) return true; // No gift option

    const gift = await getRepository(ReferralGift).findOne({
      name: giftForm.referralGift
    });
    if (gift && gift.enabled && gift.minAmount <= amount) {
      if (giftForm.referralGiftOptions) {
        const optionStockRef = Object.values(giftForm.referralGiftOptions).join(
          "/"
        );
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
      action: "update-gift-stock",
      data: {
        giftForm
      }
    });

    const gift = await getRepository(ReferralGift).findOne({
      name: giftForm.referralGift
    });
    if (gift && giftForm.referralGiftOptions) {
      const optionStockRef = Object.values(giftForm.referralGiftOptions).join(
        "/"
      );
      const optionStock = gift.stock.get(optionStockRef);
      if (optionStock !== undefined) {
        // TODO: this update isn't atomic
        gift.stock.set(optionStockRef, optionStock - 1);
        getRepository(ReferralGift).update(gift.name, { stock: gift.stock });
      }
    }
  }

  static async createReferral(
    referrer: Member | undefined,
    referee: Member,
    giftForm: ReferralGiftForm
  ): Promise<void> {
    log.info({
      action: "create-referral",
      data: {
        referrerId: referrer?.id,
        refereeId: referee.id,
        giftForm,
        refereeAmount: referee.contributionMonthlyAmount
      }
    });

    const referral = new Referral();
    referral.referrer = referrer;
    referral.referee = referee;
    referral.refereeAmount = referee.contributionMonthlyAmount || 0;
    referral.refereeGift = {
      name: giftForm.referralGift || ""
    } as ReferralGift;
    referral.refereeGiftOptions = giftForm.referralGiftOptions;

    await getRepository(Referral).save(referral);

    await ReferralsService.updateGiftStock(giftForm);

    if (referrer) {
      await EmailService.sendTemplateToMember("successful-referral", referrer, {
        refereeName: referee.firstname,
        isEligible:
          !!referee.contributionMonthlyAmount &&
          referee.contributionMonthlyAmount >= 3
      });
    }
  }

  static async getMemberReferrals(referrer: Member): Promise<Referral[]> {
    return await getRepository(Referral).find({
      relations: ["referrerGift", "referee"],
      where: { referrer }
    });
  }

  static async setReferrerGift(
    referral: Referral,
    giftForm: ReferralGiftForm
  ): Promise<boolean> {
    if (
      !referral.referrerHasSelected &&
      ReferralsService.isGiftAvailable(giftForm, referral.refereeAmount)
    ) {
      await getRepository(Referral).update(referral.id, {
        referrerGift:
          giftForm.referralGift !== undefined
            ? { name: giftForm.referralGift }
            : undefined,
        referrerGiftOptions: giftForm.referralGiftOptions,
        referrerHasSelected: true
      });

      await ReferralsService.updateGiftStock(giftForm);
      return true;
    }

    return false;
  }

  static async permanentlyDeleteMember(member: Member): Promise<void> {
    await getRepository(Referral).update(
      { referrer: member },
      { referrer: undefined }
    );
  }
}

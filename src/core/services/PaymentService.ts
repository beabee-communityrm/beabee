import { createQueryBuilder, getRepository } from "typeorm";

import { ContributionInfo, PaymentForm, PaymentMethod } from "@core/utils";
import { log as mainLogger } from "@core/logging";
import { calcRenewalDate } from "@core/utils/payment";

import Member from "@models/Member";
import Payment from "@models/Payment";
import PaymentData from "@models/PaymentData";

import {
  PaymentProvider,
  UpdateContributionResult
} from "@core/providers/payment";
import GCProvider from "@core/providers/payment/GCProvider";
import StripeProvider from "@core/providers/payment/StripeProvider";

import { CompletedPaymentFlow } from "@core/providers/payment-flow";

const log = mainLogger.child({ app: "payment-service" });

const PaymentProviders = {
  [PaymentMethod.Card]: StripeProvider,
  [PaymentMethod.DirectDebit]: GCProvider
};

class PaymentService {
  async getData(member: Member): Promise<PaymentData> {
    const data = await getRepository(PaymentData).findOneOrFail(member.id);
    // Load full member into data
    return { ...data, member };
  }

  async getDataBy(
    key: string,
    value: string
  ): Promise<PaymentData | undefined> {
    const data = await createQueryBuilder(PaymentData, "pd")
      .innerJoinAndSelect("pd.member", "m")
      .where(`data->>:key = :value`, { key, value })
      .getOne();

    return data;
  }

  async updateDataBy(member: Member, key: string, value: unknown) {
    await createQueryBuilder(PaymentData, "pd")
      .update()
      .set({ data: () => "jsonb_set(pd.data, :key, :value)" })
      .where("pd.member = :id")
      .setParameters({
        key: `{${key}}`,
        value: JSON.stringify(value),
        id: member.id
      })
      .execute();
  }

  private async provider<T>(
    member: Member,
    fn: (provider: PaymentProvider<any>) => Promise<void>
  ): Promise<void>;
  private async provider<T>(
    member: Member,
    fn: (provider: PaymentProvider<any>) => Promise<T>,
    def: T
  ): Promise<T>;
  private async provider<T>(
    member: Member,
    fn: (provider: PaymentProvider<any>) => Promise<T>,
    def?: T
  ): Promise<T | void> {
    const data = await this.getData(member);
    const Provider = data.method ? PaymentProviders[data.method] : undefined;
    if (Provider) {
      return await fn(new Provider(data));
    }

    return def;
  }

  async canChangeContribution(
    member: Member,
    useExistingPaymentSource: boolean
  ): Promise<boolean> {
    return await this.provider(
      member,
      (p) => p.canChangeContribution(useExistingPaymentSource),
      !useExistingPaymentSource
    );
  }

  async getContributionInfo(member: Member): Promise<ContributionInfo> {
    const basicInfo = {
      type: member.contributionType,
      ...(member.contributionAmount !== null && {
        amount: member.contributionAmount
      }),
      ...(member.contributionPeriod !== null && {
        period: member.contributionPeriod
      }),
      ...(member.membership?.dateExpires && {
        membershipExpiryDate: member.membership.dateExpires
      })
    };

    const providerInfo = await this.provider(
      member,
      (p) => p.getContributionInfo(),
      {}
    );

    const hsaCancelled = !!providerInfo?.cancellationDate;
    const renewalDate = !hsaCancelled && calcRenewalDate(member);

    return {
      ...basicInfo,
      ...providerInfo,
      ...(renewalDate && { renewalDate }),
      membershipStatus: member.membership
        ? member.membership.isActive
          ? hsaCancelled
            ? "expiring"
            : "active"
          : "expired"
        : "none"
    };
  }

  async getPayments(member: Member): Promise<Payment[]> {
    return await getRepository(Payment).find({ member });
  }

  async createMember(member: Member): Promise<void> {
    log.info("Create member for " + member.id);
    await getRepository(PaymentData).save({ member });
  }

  async updateMember(member: Member, updates: Partial<Member>): Promise<void> {
    log.info("Update member for " + member.id);
    await this.provider(member, (p) => p.updateMember(updates));
  }

  async updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult> {
    log.info("Update contribution for " + member.id);
    return await this.provider(
      member,
      (p) => p.updateContribution(paymentForm),
      {
        startNow: true,
        expiryDate: new Date()
      }
    );
  }

  async updatePaymentSource(
    member: Member,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    log.info("Update payment source for " + member.id);
    const newMethod = completedPaymentFlow.paymentMethod;
    // TODO: how to transition between methods?
    await getRepository(PaymentData).update(member.id, {
      method: newMethod
    });
    await this.provider(member, (p) =>
      p.updatePaymentSource(completedPaymentFlow)
    );
  }

  async cancelContribution(member: Member, keepMandate = false): Promise<void> {
    log.info("Cancel contribution for " + member.id);
    await this.provider(member, (p) => p.cancelContribution(keepMandate));
  }

  async permanentlyDeleteMember(member: Member): Promise<void> {
    await this.provider(member, (p) => p.permanentlyDeleteMember());
    await getRepository(PaymentData).delete({ member });
    await getRepository(Payment).delete({ member });
  }
}

export default new PaymentService();

import { getRepository } from "typeorm";

import {
  ContributionType,
  ContributionInfo,
  PaymentForm,
  PaymentMethod
} from "@core/utils";
import { log as mainLogger } from "@core/logging";
import { calcRenewalDate } from "@core/utils/payment";

import Member from "@models/Member";
import Payment from "@models/Payment";
import PaymentData from "@models/PaymentData";

import EmailService from "@core/services/EmailService";

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
  async getPaymentData(member: Member): Promise<PaymentData> {
    const paymentData = await getRepository(PaymentData).findOneOrFail(
      member.id
    );
    // Load full member into data
    return {
      ...paymentData,
      member
    };
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
    const data = await this.getPaymentData(member);
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
      false
    );
  }

  async getContributionInfo(member: Member): Promise<ContributionInfo> {
    const basicInfo = {
      type: member.contributionType,
      ...(member.contributionAmount !== null && {
        amount: member.contributionAmount
      }),
      ...(member.nextContributionAmount !== null && {
        nextAmount: member.nextContributionAmount
      }),
      ...(member.contributionPeriod !== null && {
        period: member.contributionPeriod
      }),
      ...(member.membership?.dateExpires && {
        membershipExpiryDate: member.membership.dateExpires
      })
    };

    const extraInfo = await this.getContributionExtraInfo(member);

    const hsaCancelled = !!extraInfo?.cancellationDate;
    const renewalDate = !hsaCancelled && calcRenewalDate(member);

    return {
      ...basicInfo,
      ...extraInfo,
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

  private async getContributionExtraInfo(
    member: Member
  ): Promise<Partial<ContributionInfo> | undefined> {
    return await this.provider(
      member,
      (p) => p.getContributionInfo(),
      undefined
    );
  }

  async getPayments(member: Member): Promise<Payment[]> {
    return await this.provider(member, (p) => p.getPayments(), []);
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
      async (p) => {
        // At the moment the only possibility is to go from whatever contribution
        // type the user was before to an automatic contribution
        const wasManual = member.contributionType === ContributionType.Manual;

        const ret = await p.updateContribution(paymentForm);

        if (wasManual) {
          await EmailService.sendTemplateToMember(
            "manual-to-automatic",
            member
          );
        }

        return ret;
      },
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

    const data = await this.getPaymentData(member);
    await new PaymentProviders[newMethod](data).updatePaymentSource(
      completedPaymentFlow
    );
    await getRepository(PaymentData).update(member.id, {
      method: newMethod
    });
  }

  async cancelContribution(member: Member, keepMandate = false): Promise<void> {
    log.info("Cancel contribution for " + member.id);
    await this.provider(member, (p) => p.cancelContribution(keepMandate));
  }

  async permanentlyDeleteMember(member: Member): Promise<void> {
    await this.provider(member, (p) => p.permanentlyDeleteMember());
  }
}

export default new PaymentService();

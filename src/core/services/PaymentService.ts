import { getRepository } from "typeorm";

import {
  ContributionType,
  ContributionInfo,
  PaymentForm,
  PaymentMethod
} from "@core/utils";
import { calcRenewalDate } from "@core/utils/payment";

import Member from "@models/Member";
import Payment from "@models/Payment";
import PaymentData from "@models/PaymentData";

import EmailService from "@core/services/EmailService";

import {
  PaymentProvider,
  UpdateContributionData
} from "@core/providers/payment";
import GCProvider from "@core/providers/payment/GCProvider";
import StripeProvider from "@core/providers/payment/StripeProvider";

import { CompletedPaymentFlow } from "@core/providers/payment-flow";

const paymentProviders = {
  [PaymentMethod.Card]: StripeProvider,
  [PaymentMethod.DirectDebit]: GCProvider
};

class PaymentService implements PaymentProvider {
  async getPaymentData(member: Member): Promise<PaymentData | undefined> {
    return await getRepository(PaymentData).findOne(member.id);
  }

  private async provider(
    member: Member,
    fn: (provider: PaymentProvider) => Promise<void>
  ): Promise<void>;
  private async provider<T>(
    member: Member,
    fn: (provider: PaymentProvider) => Promise<T>,
    def: T
  ): Promise<T>;
  private async provider<T>(
    member: Member,
    fn: (provider: PaymentProvider) => Promise<T>,
    def?: T
  ): Promise<T | void> {
    const data = await this.getPaymentData(member);
    const provider = data?.method ? paymentProviders[data.method] : undefined;
    if (provider) {
      return await fn(provider);
    }

    return def;
  }

  async hasPendingPayment(member: Member): Promise<boolean> {
    return await this.provider(
      member,
      (p) => p.hasPendingPayment(member),
      false
    );
  }

  async canChangeContribution(
    member: Member,
    useExistingPaymentSource: boolean
  ): Promise<boolean> {
    return await this.provider(
      member,
      (p) => p.canChangeContribution(member, useExistingPaymentSource),
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

    return {
      ...basicInfo,
      ...extraInfo,
      ...(!hsaCancelled && {
        renewalDate: calcRenewalDate(member)
      }),
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
      (p) => p.getContributionInfo(member),
      undefined
    );
  }

  async getPayments(member: Member): Promise<Payment[]> {
    return await this.provider(member, (p) => p.getPayments(member), []);
  }

  async updateMember(member: Member, updates: Partial<Member>): Promise<void> {
    await this.provider(member, (p) => p.updateMember(member, updates));
  }

  async updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionData> {
    return await this.provider(
      member,
      async (p) => {
        // At the moment the only possibility is to go from whatever contribution
        // type the user was before to an automatic contribution
        const wasManual = member.contributionType === ContributionType.Manual;

        const ret = await p.updateContribution(member, paymentForm);

        if (wasManual) {
          await EmailService.sendTemplateToMember(
            "manual-to-gocardless",
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
    await this.provider(member, (p) =>
      p.updatePaymentSource(member, completedPaymentFlow)
    );
  }

  async cancelContribution(member: Member): Promise<void> {
    await this.provider(member, (p) => p.cancelContribution(member));
  }

  async permanentlyDeleteMember(member: Member): Promise<void> {
    await this.provider(member, (p) => p.permanentlyDeleteMember(member));
  }
}

export default new PaymentService();

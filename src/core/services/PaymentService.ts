import { getRepository } from "typeorm";

import {
  ContributionType,
  ContributionInfo,
  PaymentForm,
  PaymentMethod
} from "@core/utils";
import { calcRenewalDate } from "@core/utils/payment";

import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";
import Payment from "@models/Payment";
import PaymentData from "@models/PaymentData";

import EmailService from "@core/services/EmailService";

import {
  CompletedPaymentFlow,
  CompletedPaymentFlowData,
  PaymentFlow,
  PaymentFlowData,
  PaymentProvider,
  UpdateContributionData
} from "@core/providers/payment";
import GCPaymentProvider from "@core/providers/payment/GCPaymentProvider";
import StripePaymentProvider from "@core/providers/payment/StripePaymentProvider";

const paymentProviders: Record<PaymentMethod, PaymentProvider> = {
  [PaymentMethod.Card]: StripePaymentProvider,
  [PaymentMethod.DirectDebit]: GCPaymentProvider
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
        // type the user was before to a GC contribution
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

  async createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow> {
    return paymentProviders[joinFlow.joinForm.paymentMethod].createPaymentFlow(
      joinFlow,
      completeUrl,
      data
    );
  }

  async completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    return paymentProviders[
      joinFlow.joinForm.paymentMethod
    ].completePaymentFlow(joinFlow);
  }

  async getCompletedPaymentFlowData(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData> {
    return paymentProviders[
      completedPaymentFlow.paymentMethod
    ].getCompletedPaymentFlowData(completedPaymentFlow);
  }
}

export default new PaymentService();

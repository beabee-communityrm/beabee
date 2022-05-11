import { getRepository } from "typeorm";

import {
  ContributionType,
  ContributionInfo,
  PaymentForm,
  PaymentMethod
} from "@core/utils";
import { calcRenewalDate } from "@core/utils/payment";

import GCPaymentData from "@models/GCPaymentData";
import JoinFlow from "@models/JoinFlow";
import ManualPaymentData from "@models/ManualPaymentData";
import Member from "@models/Member";

import EmailService from "./EmailService";
import GCPaymentService from "./GCPaymentService";
import StripePaymentService from "./StripePaymentService";
import {
  CompletedPaymentFlow,
  CompletedPaymentFlowData,
  PaymentFlow,
  PaymentFlowData,
  UpdateContributionData
} from "@core/providers/payment";

const paymentProviders = {
  [PaymentMethod.Card]: StripePaymentService,
  [PaymentMethod.DirectDebit]: GCPaymentService
};

class PaymentService {
  async getPaymentData(
    member: Member
  ): Promise<GCPaymentData | ManualPaymentData | undefined> {
    switch (member.contributionType) {
      case ContributionType.GoCardless:
        return await GCPaymentService.getPaymentData(member);
      case ContributionType.Manual:
        return await getRepository(ManualPaymentData).findOne(member.id);
    }
  }

  async canChangeContribution(
    member: Member,
    useExistingPaymentSource: boolean
  ): Promise<boolean> {
    switch (member.contributionType) {
      case ContributionType.GoCardless:
        return await GCPaymentService.canChangeContribution(
          member,
          useExistingPaymentSource
        );

      // Other contributions don't have a payment source
      default:
        return !useExistingPaymentSource;
    }
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
    switch (member.contributionType) {
      case ContributionType.GoCardless:
        return await GCPaymentService.getContributionInfo(member);
    }
  }

  async updateMember(member: Member, updates: Partial<Member>): Promise<void> {
    await GCPaymentService.updateMember(member, updates);
  }

  async updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionData> {
    // At the moment the only possibility is to go from whatever contribution
    // type the user was before to a GC contribution
    const wasManual = member.contributionType === ContributionType.Manual;

    // TODO: Retrieve actual payment method
    const paymentMethod = PaymentMethod.DirectDebit as PaymentMethod;

    const ret = await paymentProviders[paymentMethod].updateContribution(
      member,
      paymentForm
    );

    if (wasManual) {
      await EmailService.sendTemplateToMember("manual-to-gocardless", member);
    }

    return ret;
  }

  async updatePaymentSource(
    member: Member,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    // TODO: Retrieve actual payment method
    const paymentMethod = PaymentMethod.DirectDebit as PaymentMethod;

    // At the moment the only possibility is to go from whatever contribution
    // type the user was before to a GC contribution
    // TODO: This is currently used to update the user's contributionType, this will change

    await paymentProviders[paymentMethod].updatePaymentSource(
      member,
      completedPaymentFlow
    );
  }

  async cancelContribution(member: Member): Promise<void> {
    switch (member.contributionType) {
      case ContributionType.GoCardless:
        return await GCPaymentService.cancelContribution(member);
      default:
        throw new Error("Not implemented");
    }
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
    paymentMethod: PaymentMethod,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData> {
    return paymentProviders[paymentMethod].getCompletedPaymentFlowData(
      completedPaymentFlow
    );
  }
}

export default new PaymentService();

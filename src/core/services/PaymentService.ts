import { getRepository } from "typeorm";

import { ContributionType, ContributionInfo, PaymentForm } from "@core/utils";

import GCPaymentData from "@models/GCPaymentData";
import ManualPaymentData from "@models/ManualPaymentData";
import Member from "@models/Member";

import GCPaymentService from "./GCPaymentService";

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

  async getContributionInfo(
    member: Member
  ): Promise<ContributionInfo | undefined> {
    switch (member.contributionType) {
      case ContributionType.GoCardless:
        return await GCPaymentService.getContributionInfo(member);
      case ContributionType.Manual:
        return {
          amount: member.contributionAmount,
          period: member.contributionPeriod,
          type: ContributionType.Manual,
          isActive: true
        };
    }
  }

  async updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<void> {
    switch (member.contributionType) {
      case ContributionType.GoCardless:
        await GCPaymentService.updateContribution(member, paymentForm);
      default:
        throw new Error("Not implemented");
    }
  }

  async updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void> {
    switch (member.contributionType) {
      case ContributionType.GoCardless:
        await GCPaymentService.updatePaymentSource(
          member,
          customerId,
          mandateId
        );
      default:
        throw new Error("Not implemented");
    }
  }
}

export default new PaymentService();

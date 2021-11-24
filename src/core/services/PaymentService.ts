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
    const basicInfo = {
      type: member.contributionType,
      amount: member.contributionAmount,
      period: member.contributionPeriod,
      membershipExpiryDate: member.membershipExpires
    };

    const extraInfo =
      member.contributionType === ContributionType.GoCardless
        ? await GCPaymentService.getContributionInfo(member)
        : undefined;

    const memberPermission = member.permissions.find(
      (p) => p.permission === "member"
    );

    return {
      ...basicInfo,
      ...extraInfo,
      membershipStatus: memberPermission
        ? memberPermission.isActive
          ? extraInfo?.cancellationDate
            ? "expiring"
            : "active"
          : "expired"
        : "none"
    };
  }

  async updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<void> {
    // At the moment the only possibility is to go from whatever contribution
    // type the user was before to a GC contribution
    return await GCPaymentService.updateContribution(member, paymentForm);
  }

  async updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void> {
    // At the moment the only possibility is to go from whatever contribution
    // type the user was before to a GC contribution
    return await GCPaymentService.updatePaymentSource(
      member,
      customerId,
      mandateId
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
}

export default new PaymentService();

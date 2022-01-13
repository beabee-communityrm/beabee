import { getRepository } from "typeorm";

import { ContributionType, ContributionInfo, PaymentForm } from "@core/utils";

import GCPaymentData from "@models/GCPaymentData";
import ManualPaymentData from "@models/ManualPaymentData";
import Member from "@models/Member";

import EmailService from "./EmailService";
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

    return {
      ...basicInfo,
      ...extraInfo,
      membershipStatus: member.membership
        ? member.membership.isActive
          ? extraInfo?.cancellationDate
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
      case ContributionType.Manual:
        if (member.membership?.dateExpires) {
          return {
            renewalDate: member.membership.dateExpires
          };
        }
    }
  }

  async updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<void> {
    // At the moment the only possibility is to go from whatever contribution
    // type the user was before to a GC contribution
    const wasManual = member.contributionType === ContributionType.Manual;
    await GCPaymentService.updateContribution(member, paymentForm);

    if (wasManual) {
      await EmailService.sendTemplateToMember("manual-to-gocardless", member);
    }
  }

  async updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void> {
    // At the moment the only possibility is to go from whatever contribution
    // type the user was before to a GC contribution
    await GCPaymentService.updatePaymentSource(member, customerId, mandateId);
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

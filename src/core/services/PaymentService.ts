import { getRepository } from "typeorm";

import { ContributionType, ContributionInfo } from "@core/utils";

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

  async getContributionInfo(
    member: Member
  ): Promise<ContributionInfo | undefined> {
    switch (member.contributionType) {
      case ContributionType.GoCardless:
        return await GCPaymentService.getContributionInfo(member);
      case ContributionType.Manual:
        return {
          type: ContributionType.Manual,
          isActive: true
        };
    }
  }
}

export default new PaymentService();

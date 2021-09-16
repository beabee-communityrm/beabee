import { getRepository } from "typeorm";

import { ContributionType, PaymentForm } from "@core/utils";

import {
  PaymentRedirectFlow,
  PaymentRedirectFlowParams
} from "@core/providers/payment";

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

  async updatePaymentMethod() {}

  async updateContribution() {}

  async hasPendingPayments(member: Member): Promise<boolean> {
    return false;
  }

  private getProvider(member: Member) {}

  async createRedirectFlow(
    sessionToken: string,
    completeUrl: string,
    paymentForm: PaymentForm,
    params: PaymentRedirectFlowParams
  ): Promise<PaymentRedirectFlow> {
    return {
      id: "",
      url: ""
    };
  }
}

export default new PaymentService();

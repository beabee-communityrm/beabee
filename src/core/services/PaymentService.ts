import { getRepository } from "typeorm";

import { ContributionType } from "@core/utils";

import GCPaymentData from "@models/GCPaymentData";
import ManualPaymentData from "@models/ManualPaymentData";
import Member from "@models/Member";

import GCPaymentService from "./GCPaymentService";

export interface PaymentSource {
  type: "direct-debit";
  bankName: string;
  accountHolderName: string;
  accountNumberEnding: string;
}

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

  async getPaymentSource(member: Member): Promise<PaymentSource | undefined> {
    if (member.contributionType === ContributionType.GoCardless) {
      const bankAccount = await GCPaymentService.getBankAccount(member);
      return bankAccount
        ? {
            type: "direct-debit",
            bankName: bankAccount.bank_name,
            accountHolderName: bankAccount.account_holder_name,
            accountNumberEnding: bankAccount.account_number_ending
          }
        : undefined;
    }
  }
}

export default new PaymentService();

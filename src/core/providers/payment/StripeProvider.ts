import { PaymentProvider, UpdateContributionData } from ".";
import { CompletedPaymentFlow } from "@core/providers/payment-flow";

import { ContributionInfo, PaymentForm } from "@core/utils";

import Member from "@models/Member";
import Payment from "@models/Payment";

class StripeProvider implements PaymentProvider {
  getPayments(member: Member): Promise<Payment[]> {
    throw new Error("Method not implemented.");
  }
  permanentlyDeleteMember(member: Member): Promise<void> {
    throw new Error("Method not implemented.");
  }
  canChangeContribution(
    member: Member,
    useExistingMandate: boolean
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getContributionInfo(
    member: Member
  ): Promise<Partial<ContributionInfo> | undefined> {
    throw new Error("Method not implemented.");
  }
  updateMember(member: Member, updates: Partial<Member>): Promise<void> {
    throw new Error("Method not implemented.");
  }
  hasPendingPayment(member: Member): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  cancelContribution(member: Member): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async updatePaymentSource(
    member: Member,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {}

  async updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionData> {
    throw new Error("Moethod not implemented.");
  }
}

export default new StripeProvider();

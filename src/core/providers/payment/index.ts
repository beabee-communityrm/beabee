import { ContributionInfo, PaymentForm } from "@core/utils";

import { CompletedPaymentFlow } from "@core/providers/payment-flow";

import Member from "@models/Member";
import Payment from "@models/Payment";

export interface UpdateContributionData {
  startNow: boolean;
  expiryDate: Date;
}

export interface PaymentProvider {
  hasPendingPayment(member: Member): Promise<boolean>;

  canChangeContribution(
    member: Member,
    useExistingMandate: boolean
  ): Promise<boolean>;

  cancelContribution(member: Member): Promise<void>;

  getContributionInfo(
    member: Member
  ): Promise<Partial<ContributionInfo> | undefined>;

  getPayments(member: Member): Promise<Payment[]>;

  updateMember(member: Member, updates: Partial<Member>): Promise<void>;

  updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionData>;

  updatePaymentSource(
    member: Member,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void>;

  permanentlyDeleteMember(member: Member): Promise<void>;
}

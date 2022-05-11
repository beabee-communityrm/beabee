import { PaymentForm } from "@core/utils";

import Address from "@models/Address";
import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";

export interface PaymentFlow {
  id: string;
  params: PaymentFlowParams;
}

export interface PaymentFlowParams {
  clientSecret?: string;
  redirectUrl?: string;
}

export interface PaymentFlowData {
  email: string;
  firstname?: string;
  lastname?: string;
}

export interface CompletedPaymentFlow {
  customerId: string;
  mandateId: string;
}

export interface CompletedPaymentFlowData {
  firstname?: string;
  lastname?: string;
  billingAddress?: Address;
}

export interface UpdateContributionData {
  startNow: boolean;
  expiryDate: Date;
}

export interface PaymentProvider {
  createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow>;

  completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow>;

  getCompletedPaymentFlowData(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData>;

  hasPendingPayment(member: Member): Promise<boolean>;

  cancelContribution(member: Member): Promise<void>;

  updateMember(member: Member, updates: Partial<Member>): Promise<void>;

  updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionData>;

  updatePaymentSource(
    member: Member,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void>;
}

import { PaymentForm } from "@core/utils";

import Address from "@models/Address";
import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";

export interface PaymentFlow {
  id: string;
  url: string;
}

export interface PaymentFlowParams {
  email: string;
  firstname?: string;
  lastname?: string;
}

export interface CompletedPaymentFlow {
  customerId: string;
  mandateId: string;
}

export interface PaymentProvider {
  customerToMember(customerId: string): Promise<{
    partialMember: Partial<Member>;
    billingAddress: Address;
  }>;

  createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    params: PaymentFlowParams
  ): Promise<PaymentFlow>;

  completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow>;

  hasPendingPayment(member: Member): Promise<boolean>;

  cancelContribution(member: Member): Promise<void>;

  updateContribution(member: Member, paymentForm: PaymentForm): Promise<void>;

  updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void>;
}

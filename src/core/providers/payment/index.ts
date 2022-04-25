import { PaymentForm } from "@core/utils";

import Address from "@models/Address";
import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";

export interface PaymentRedirectFlowParams {
  email: string;
  firstname?: string;
  lastname?: string;
}

export interface PaymentRedirectFlow {
  id: string;
  url: string;
}

export interface CompletedPaymentRedirectFlow {
  customerId: string;
  mandateId: string;
}

export interface PaymentProvider {
  customerToMember(customerId: string): Promise<{
    partialMember: Partial<Member>;
    billingAddress: Address;
  }>;

  createRedirectFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    params: PaymentRedirectFlowParams
  ): Promise<PaymentRedirectFlow>;

  completeRedirectFlow(
    joinFlow: JoinFlow
  ): Promise<CompletedPaymentRedirectFlow>;

  hasPendingPayment(member: Member): Promise<boolean>;

  cancelContribution(member: Member): Promise<void>;

  updateContribution(member: Member, paymentForm: PaymentForm): Promise<void>;

  updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void>;
}

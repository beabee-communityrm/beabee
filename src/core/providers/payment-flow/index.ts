import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";

import { Address } from "@type/address";

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
  joinForm: JoinForm;
  customerId: string;
  mandateId: string;
}

export interface CompletedPaymentFlowData {
  firstname?: string;
  lastname?: string;
  billingAddress?: Address;
}

export interface PaymentFlowProvider {
  createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow>;

  completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow>;

  getCompletedPaymentFlowData(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData>;
}

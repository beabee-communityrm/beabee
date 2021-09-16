import { PaymentForm } from "@core/utils";

export interface PaymentRedirectFlowParams {
  email: string;
  firstname?: string;
  lastname?: string;
}

export interface PaymentRedirectFlow {
  id: string;
  url: string;
}

export interface PaymentProvider {
  createRedirectFlow(
    sessionToken: string,
    completeUrl: string,
    paymentForm: PaymentForm,
    params: PaymentRedirectFlowParams
  ): Promise<PaymentRedirectFlow>;
}

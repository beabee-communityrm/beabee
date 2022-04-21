import { PaymentForm } from "@core/utils";

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

export interface PaymentProvider {
  createRedirectFlow(
    sessionToken: string,
    completeUrl: string,
    params: PaymentRedirectFlowParams
  ): Promise<PaymentRedirectFlow>;

  hasPendingPayment(member: Member): Promise<boolean>;

  cancelContribution(member: Member): Promise<void>;
}

import { PaymentFlowParams } from "@beabee/beabee-common";

export interface PaymentFlow {
  id: string;
  params: PaymentFlowParams;
}

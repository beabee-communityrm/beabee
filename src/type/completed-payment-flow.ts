import { PaymentMethod } from "@beabee/beabee-common";

export interface CompletedPaymentFlow {
  paymentMethod: PaymentMethod;
  customerId: string;
  mandateId: string;
}

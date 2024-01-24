import { PaymentMethod } from "@beabee/beabee-common";

export interface GoCardlessDirectDebitPaymentSource {
  method: PaymentMethod.GoCardlessDirectDebit;
  bankName: string;
  accountHolderName: string;
  accountNumberEnding: string;
}

export interface StripeCardPaymentSource {
  method: PaymentMethod.StripeCard;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface StripeBACSPaymentSource {
  method: PaymentMethod.StripeBACS;
  sortCode: string;
  last4: string;
}

export interface StripeSEPAPaymentSource {
  method: PaymentMethod.StripeSEPA;
  country: string;
  bankCode: string;
  branchCode: string;
  last4: string;
}

export interface ManualPaymentSource {
  method: null;
  source?: string;
  reference?: string;
}

export type PaymentSource =
  | GoCardlessDirectDebitPaymentSource
  | StripeCardPaymentSource
  | StripeBACSPaymentSource
  | StripeSEPAPaymentSource
  | ManualPaymentSource;

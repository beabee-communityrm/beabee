import type Stripe from "stripe";
export type StripeTaxRateCreateParams = Stripe.TaxRateUpdateParams &
  Pick<Stripe.TaxRateCreateParams, "percentage">;

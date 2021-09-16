import stripe from "@core/lib/stripe";
import { getActualAmount, PaymentForm } from "@core/utils";

import {
  PaymentProvider,
  PaymentRedirectFlow,
  PaymentRedirectFlowParams
} from "@core/providers/payment";

import config from "@config";

import Member from "@models/Member";

class StripePaymentService implements PaymentProvider {
  async hasPendingPayment(member: Member): Promise<boolean> {
    return false;
  }

  cancelContribution(member: Member): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async createRedirectFlow(
    sessionToken: string,
    completeUrl: string,
    paymentForm: PaymentForm,
    params: PaymentRedirectFlowParams
  ): Promise<PaymentRedirectFlow> {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.currencyCode,
            unit_amount: getActualAmount(
              paymentForm.monthlyAmount,
              paymentForm.period
            ),
            product: config.stripe.productId
          }
        }
      ],
      success_url: completeUrl,
      cancel_url: "",
      client_reference_id: sessionToken,
      customer_email: params.email
    });

    return {
      id: session.id,
      url: session.url
    };
  }
}

export default new StripePaymentService();

import type Stripe from "stripe";

import stripe from "@core/lib/stripe";

import {
  CompletedPaymentFlow,
  CompletedPaymentFlowData,
  PaymentFlow,
  PaymentFlowProvider
} from ".";

import JoinFlow from "@models/JoinFlow";

class StripeProvider implements PaymentFlowProvider {
  async createPaymentFlow(): Promise<PaymentFlow> {
    // TODO: check joinFlow for correct payment method
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"]
    });

    return {
      id: setupIntent.id,
      params: {
        clientSecret: setupIntent.client_secret as string
      }
    };
  }

  async completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    const setupIntent = await stripe.setupIntents.retrieve(
      joinFlow.paymentFlowId
    );

    const paymentMethod = setupIntent.payment_method as string;

    return {
      paymentMethod: joinFlow.joinForm.paymentMethod,
      customerId: "", // Not needed
      mandateId: paymentMethod
    };
  }

  async getCompletedPaymentFlowData(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData> {
    const paymentMethod = await stripe.paymentMethods.retrieve(
      completedPaymentFlow.mandateId
    );

    const address = paymentMethod.billing_details.address;
    return {
      ...(address && {
        billingAddress: {
          line1: address.line1 || "",
          line2: address.line2 || undefined,
          city: address.city || "",
          postcode: address.postal_code || ""
        }
      })
    };
  }
}

export default new StripeProvider();
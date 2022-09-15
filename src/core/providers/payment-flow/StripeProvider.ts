import stripe from "@core/lib/stripe";
import { log as mainLogger } from "@core/logging";
import { paymentMethodToType } from "@core/utils/payment/stripe";

import {
  CompletedPaymentFlow,
  CompletedPaymentFlowData,
  PaymentFlow,
  PaymentFlowProvider
} from ".";

import JoinFlow from "@models/JoinFlow";

const log = mainLogger.child({ app: "stripe-payment-flow-provider" });

class StripeProvider implements PaymentFlowProvider {
  async createPaymentFlow(joinFlow: JoinFlow): Promise<PaymentFlow> {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: [
        paymentMethodToType(joinFlow.joinForm.paymentMethod)
      ]
    });

    log.info("Created setup intent " + setupIntent.id);

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

    log.info("Fetched setup intent " + setupIntent.id);

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

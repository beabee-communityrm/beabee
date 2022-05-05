import type Stripe from "stripe";

import stripe from "@core/lib/stripe";

import {
  CompletedPaymentFlow,
  PaymentProvider,
  PaymentFlow,
  PaymentFlowData
} from "@core/providers/payment";

import { ContributionPeriod, getActualAmount, PaymentForm } from "@core/utils";

import Address from "@models/Address";
import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";

import config from "@config";

class StripePaymentService implements PaymentProvider {
  updatePaymentSource(
    member: Member,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  updateContribution(member: Member, paymentForm: PaymentForm): Promise<void> {
    throw new Error("Method not implemented.");
  }
  customerToMember(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<{ partialMember: Partial<Member>; billingAddress: Address }> {
    throw new Error("Method not implemented.");
  }
  async createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow> {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"]
    });

    /*
    return {
      id: subscription.id,
      params: {
        clientSecret:
          (
            (subscription.latest_invoice as Stripe.Invoice)
              .payment_intent as Stripe.PaymentIntent
          ).client_secret || ""
      }
    };*/

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

    const customer = await stripe.customers.create({
      email: joinFlow.joinForm.email,
      payment_method: paymentMethod
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price_data: {
            currency: config.currencyCode,
            product: config.stripe.membershipProductId,
            recurring: {
              interval:
                joinFlow.joinForm.period === ContributionPeriod.Monthly
                  ? "month"
                  : "year"
            },
            unit_amount:
              getActualAmount(
                joinFlow.joinForm.monthlyAmount,
                joinFlow.joinForm.period
              ) * 100
          }
        }
      ],
      default_payment_method: paymentMethod,
      payment_behavior: "default_incomplete"
    });

    return {
      customerId: customer.id,
      mandateId: subscription.id // TODO: not needed
    };
  }

  hasPendingPayment(member: Member): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  cancelContribution(member: Member): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default new StripePaymentService();

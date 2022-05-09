import type Stripe from "stripe";

import stripe from "@core/lib/stripe";

import {
  CompletedPaymentFlow,
  PaymentProvider,
  PaymentFlow,
  PaymentFlowData,
  CompletedPaymentFlowData
} from "@core/providers/payment";

import { ContributionPeriod, getActualAmount, PaymentForm } from "@core/utils";

import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";

import config from "@config";

class StripePaymentService implements PaymentProvider {
  hasPendingPayment(member: Member): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  cancelContribution(member: Member): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async updatePaymentSource(
    member: Member,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {}

  async updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<void> {}

  async createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow> {
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

  async getCompletedPaymentFlowData(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData> {
    const customer = (await stripe.customers.retrieve(
      completedPaymentFlow.customerId
    )) as Stripe.Customer;

    return {
      ...(customer.address && {
        billingAddress: {
          line1: customer.address.line1 || "",
          line2: customer.address.line2 || undefined,
          city: customer.address.city || "",
          postcode: customer.address.postal_code || ""
        }
      })
    };
  }
}

export default new StripePaymentService();

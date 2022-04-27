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
  completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    throw new Error("Method not implemented.");
  }
  updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  updateContribution(member: Member, paymentForm: PaymentForm): Promise<void> {
    throw new Error("Method not implemented.");
  }
  customerToMember(
    customerId: string
  ): Promise<{ partialMember: Partial<Member>; billingAddress: Address }> {
    throw new Error("Method not implemented.");
  }
  async createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow> {
    const customer = await stripe.customers.create({
      email: data.email,
      ...(data.firstname &&
        data.lastname && {
          name: `${data.firstname} ${data.lastname}`
        })
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
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"]
    });

    return {
      id: subscription.id,
      params: {
        clientSecret:
          (
            (subscription.latest_invoice as Stripe.Invoice)
              .payment_intent as Stripe.PaymentIntent
          ).client_secret || ""
      }
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

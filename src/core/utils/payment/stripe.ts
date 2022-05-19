import { differenceInMonths, subMonths } from "date-fns";
import Stripe from "stripe";

import stripe from "@core/lib/stripe";
import { ContributionPeriod, getActualAmount, PaymentForm } from "@core/utils";

import config from "@config";

function getChargeableAmount(paymentForm: PaymentForm): number {
  const actualAmount = getActualAmount(
    paymentForm.monthlyAmount,
    paymentForm.period
  );
  const chargeableAmount = paymentForm.payFee
    ? actualAmount * 100
    : actualAmount * 100;
  return Math.round(chargeableAmount);
}

function getPriceData(
  paymentForm: PaymentForm
): Stripe.SubscriptionCreateParams.Item.PriceData {
  return {
    currency: config.currencyCode,
    product: config.stripe.membershipProductId,
    recurring: {
      interval:
        paymentForm.period === ContributionPeriod.Monthly ? "month" : "year"
    },
    unit_amount: getChargeableAmount(paymentForm)
  };
}

export async function createSubscription(
  customerId: string,
  paymentForm: PaymentForm,
  startDate?: Date
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price_data: getPriceData(paymentForm) }],
    off_session: true
  });

  // TODO: start date

  return subscription;
}

export async function updateSubscription(
  subscriptionId: string,
  paymentForm: PaymentForm
): Promise<{ subscription: Stripe.Subscription; startNow: boolean }> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const renewalDate = new Date(subscription.current_period_end * 1000);
  const monthsLeft = Math.max(0, differenceInMonths(renewalDate, new Date()));
  const prorationDate = subMonths(renewalDate, monthsLeft);

  const subscriptionItems = [
    {
      id: subscription.items.data[0].id,
      price_data: getPriceData(paymentForm)
    }
  ];

  const invoice = await stripe.invoices.retrieveUpcoming({
    subscription: subscriptionId,
    subscription_items: subscriptionItems,
    subscription_proration_date: +prorationDate
  });

  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      proration_behavior: paymentForm.prorate ? "create_prorations" : "none",
      proration_date: +prorationDate,
      items: subscriptionItems
    }
  );

  const startNow = invoice.amount_due === 0 || paymentForm.prorate;

  return { subscription: updatedSubscription, startNow };
}

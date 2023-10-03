import {
  ContributionPeriod,
  PaymentMethod,
  PaymentStatus
} from "@beabee/beabee-common";
import { differenceInMonths } from "date-fns";
import Stripe from "stripe";

import stripe from "@core/lib/stripe";
import { log as mainLogger } from "@core/logging";
import { PaymentForm, PaymentSource } from "@core/utils";
import { getChargeableAmount } from "@core/utils/payment";

import config from "@config";

const log = mainLogger.child({ app: "stripe-utils" });

function getPriceData(
  paymentForm: PaymentForm,
  paymentMethod: PaymentMethod
): Stripe.SubscriptionCreateParams.Item.PriceData {
  return {
    currency: config.currencyCode,
    product: config.stripe.membershipProductId,
    recurring: {
      interval:
        paymentForm.period === ContributionPeriod.Monthly ? "month" : "year"
    },
    unit_amount: getChargeableAmount(paymentForm, paymentMethod)
  };
}

export async function createSubscription(
  customerId: string,
  paymentForm: PaymentForm,
  paymentMethod: PaymentMethod,
  renewalDate?: Date
): Promise<Stripe.Subscription> {
  log.info("Creating subscription on " + customerId, {
    paymentForm,
    renewalDate
  });

  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price_data: getPriceData(paymentForm, paymentMethod) }],
    off_session: true,
    ...(renewalDate &&
      renewalDate > new Date() && {
        billing_cycle_anchor: Math.floor(+renewalDate / 1000),
        proration_behavior: "none"
      })
  });
}

const SECONDS_IN_A_YEAR = 365 * 24 * 60 * 60;

export async function updateSubscription(
  subscriptionId: string,
  paymentForm: PaymentForm,
  paymentMethod: PaymentMethod
): Promise<{ subscription: Stripe.Subscription; startNow: boolean }> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["schedule"]
  });

  const renewalTs = subscription.current_period_end;
  const renewalDate = new Date(renewalTs * 1000);
  const monthsLeft = Math.max(0, differenceInMonths(renewalDate, new Date()));
  // Calculate exact number of seconds to remove (rather than just "one month")
  // as this aligns with Stripe's calculations
  const prorationTs = Math.floor(
    renewalTs - SECONDS_IN_A_YEAR * (monthsLeft / 12)
  );

  const priceData = getPriceData(paymentForm, paymentMethod);
  const subscriptionItems = [
    {
      id: subscription.items.data[0].id,
      price_data: priceData
    }
  ];

  const invoice = await stripe.invoices.retrieveUpcoming({
    subscription: subscriptionId,
    subscription_items: subscriptionItems,
    subscription_proration_date: prorationTs
  });

  const prorationAmount = invoice.lines.data
    .filter((item) => item.proration)
    .reduce((total, item) => total + item.amount, 0);

  // Only prorate amounts above 100 cents. This aligns with GoCardless's minimum
  // amount and is much simpler than trying to calculate the minimum payment per
  // payment method
  const wouldProrate = prorationAmount < 0 || prorationAmount >= 100;

  log.info("Preparing update subscription for " + subscriptionId, {
    renewalDate,
    prorationDate: new Date(prorationTs * 1000),
    wouldProrate,
    paymentForm
  });

  const startNow =
    prorationAmount >= 0 && (!wouldProrate || paymentForm.prorate);

  const oldSchedule =
    subscription.schedule as Stripe.SubscriptionSchedule | null;
  if (
    oldSchedule?.status === "active" ||
    oldSchedule?.status === "not_started"
  ) {
    log.info(`Releasing schedule ${oldSchedule.id} for ${subscription.id}`);
    await stripe.subscriptionSchedules.release(oldSchedule.id);
  }

  if (startNow) {
    log.info(`Updating subscription for ${subscription.id}`);
    await stripe.subscriptions.update(subscriptionId, {
      items: subscriptionItems,
      ...(wouldProrate && paymentForm.prorate
        ? { proration_behavior: "always_invoice", proration_date: prorationTs }
        : { proration_behavior: "none", trial_end: renewalTs })
    });
  } else {
    log.info(`Creating new schedule for ${subscription.id}`);
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscription.id
    });

    await stripe.subscriptionSchedules.update(schedule.id, {
      phases: [
        {
          start_date: schedule.phases[0].start_date,
          end_date: schedule.phases[0].end_date,
          items: [{ price: schedule.phases[0].items[0].price as string }]
        },
        {
          start_date: schedule.phases[0].end_date,
          items: [{ price_data: priceData }]
        }
      ]
    });
  }

  return { subscription, startNow };
}

export async function deleteSubscription(
  subscriptionId: string
): Promise<void> {
  try {
    await stripe.subscriptions.del(subscriptionId);
  } catch (error) {
    // Ignore resource missing errors, the subscription might have been already removed
    if (
      !(error instanceof Stripe.errors.StripeInvalidRequestError) ||
      error.code !== "resource_missing"
    ) {
      throw error;
    }
  }
}

export function paymentMethodToStripeType(
  method: PaymentMethod
): Stripe.PaymentMethod.Type {
  switch (method) {
    case PaymentMethod.StripeCard:
      return "card";
    case PaymentMethod.StripeSEPA:
      return "sepa_debit";
    case PaymentMethod.StripeBACS:
      return "bacs_debit";
    default:
      throw new Error("Unexpected payment method");
  }
}

export function stripeTypeToPaymentMethod(
  type: Stripe.PaymentMethod.Type
): PaymentMethod {
  switch (type) {
    case "card":
      return PaymentMethod.StripeCard;
    case "sepa_debit":
      return PaymentMethod.StripeSEPA;
    case "bacs_debit":
      return PaymentMethod.StripeBACS;
    default:
      throw new Error("Unexpected Stripe payment type");
  }
}

export async function manadateToSource(
  mandateId: string
): Promise<PaymentSource | undefined> {
  const method = await stripe.paymentMethods.retrieve(mandateId);

  if (method.type === "card" && method.card) {
    return {
      method: PaymentMethod.StripeCard,
      last4: method.card.last4,
      expiryMonth: method.card.exp_month,
      expiryYear: method.card.exp_year
    };
  } else if (method.type === "sepa_debit" && method.sepa_debit) {
    return {
      method: PaymentMethod.StripeSEPA,
      country: method.sepa_debit.country || "",
      bankCode: method.sepa_debit.bank_code || "",
      branchCode: method.sepa_debit.branch_code || "",
      last4: method.sepa_debit.last4 || ""
    };
  } else if (method.type === "bacs_debit" && method.bacs_debit) {
    return {
      method: PaymentMethod.StripeBACS,
      sortCode: method.bacs_debit.sort_code || "",
      last4: method.bacs_debit.last4 || ""
    };
  }
}

export function convertStatus(status: Stripe.Invoice.Status): PaymentStatus {
  switch (status) {
    case "draft":
    case "open":
      return PaymentStatus.Pending;

    case "paid":
      return PaymentStatus.Successful;

    case "void":
    case "deleted":
      return PaymentStatus.Cancelled;

    case "uncollectible":
      return PaymentStatus.Failed;
  }
}

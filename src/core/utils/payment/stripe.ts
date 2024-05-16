import {
  ContributionPeriod,
  PaymentMethod,
  PaymentStatus,
  PaymentSource
} from "@beabee/beabee-common";
import { differenceInMonths } from "date-fns";

import OptionsService from "@core/services/OptionsService";

import { stripe, Stripe } from "@core/lib/stripe";
import { log as mainLogger } from "@core/logging";
import { getChargeableAmount } from "@core/utils/payment";

import config from "@config";
import { PaymentForm } from "@type/index";

import { CompletedPaymentFlow } from "@type/completed-payment-flow";

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

async function calculateProrationParams(
  subscription: Stripe.Subscription,
  subscriptionItem: Stripe.InvoiceRetrieveUpcomingParams.SubscriptionItem
) {
  // Prorate by whole months
  const monthsLeft = Math.max(
    0,
    differenceInMonths(subscription.current_period_end * 1000, new Date())
  );
  // Calculate exact number of seconds to remove (rather than just "one month")
  // as this aligns with Stripe's calculations
  const prorationTime = Math.floor(
    subscription.current_period_end -
      (subscription.current_period_end - subscription.current_period_start) *
        (monthsLeft / 12)
  );

  const invoice = await stripe.invoices.retrieveUpcoming({
    subscription: subscription.id,
    subscription_items: [subscriptionItem],
    subscription_proration_date: prorationTime
  });

  const prorationAmount = invoice.lines.data
    .filter((item) => item.proration)
    .reduce((total, item) => total + item.amount, 0);

  return {
    // Only prorate amounts above 100 cents. This aligns with GoCardless's minimum
    // amount and is much simpler than trying to calculate the minimum payment per
    // payment method
    prorationAmount: prorationAmount < 100 ? 0 : prorationAmount,
    prorationTime
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

  const params: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price_data: getPriceData(paymentForm, paymentMethod) }],
    off_session: true,
    ...(renewalDate &&
      renewalDate > new Date() && {
        billing_cycle_anchor: Math.floor(+renewalDate / 1000),
        proration_behavior: "none"
      })
  };

  if (OptionsService.getBool("tax-rate-enabled")) {
    params.default_tax_rates = [
      OptionsService.getText("tax-rate-stripe-default-id")
    ];
  }

  return await stripe.subscriptions.create(params);
}

/**
 * Update a subscription with a new payment method.
 * @param subscriptionId
 * @param paymentForm
 * @param paymentMethod
 * @returns
 */
export async function updateSubscription(
  subscriptionId: string,
  paymentForm: PaymentForm,
  paymentMethod: PaymentMethod
): Promise<{ subscription: Stripe.Subscription; startNow: boolean }> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["schedule"]
  });
  const newSubscriptionItem = {
    id: subscription.items.data[0].id,
    price_data: getPriceData(paymentForm, paymentMethod)
  };

  const { prorationAmount, prorationTime } = await calculateProrationParams(
    subscription,
    newSubscriptionItem
  );

  log.info("Preparing update subscription for " + subscription.id, {
    renewalDate: new Date(subscription.current_period_end * 1000),
    prorationDate: new Date(prorationTime * 1000),
    prorationAmount,
    paymentForm
  });

  // Clear any previous schedule
  const oldSchedule =
    subscription.schedule as Stripe.SubscriptionSchedule | null;
  if (
    oldSchedule?.status === "active" ||
    oldSchedule?.status === "not_started"
  ) {
    log.info(`Releasing schedule ${oldSchedule.id} for ${subscription.id}`);
    await stripe.subscriptionSchedules.release(oldSchedule.id);
  }

  const startNow = prorationAmount === 0 || paymentForm.prorate;

  if (startNow) {
    const params: Stripe.SubscriptionUpdateParams = {
      items: [newSubscriptionItem],
      ...(prorationAmount > 0
        ? {
            proration_behavior: "always_invoice",
            proration_date: prorationTime
          }
        : {
            proration_behavior: "none",
            // Force it to change at the start of the next period, this is
            // important when changing from monthly to annual as otherwise
            // Stripe starts the new billing cycle immediately
            trial_end: subscription.current_period_end
          })
    };

    // Start new contribution immediately (monthly or prorated annuals)
    log.info(`Updating subscription for ${subscription.id}`);
    await stripe.subscriptions.update(subscriptionId, params);
  } else {
    // Schedule the change for the next period
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
          items: [{ price_data: newSubscriptionItem.price_data }]
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
    await stripe.subscriptions.cancel(subscriptionId);
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
    case PaymentMethod.StripePayPal:
      return "paypal";
    case PaymentMethod.GoCardlessDirectDebit:
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
    case "paypal":
      return PaymentMethod.StripePayPal;
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
      isLink: false,
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
  } else if (method.type === "paypal" && method.paypal) {
    return {
      method: PaymentMethod.StripePayPal,
      payerEmail: method.paypal.payer_email || "",
      payerId: method.paypal.payer_id || ""
    };
  } else if (method.type === "link" && method.link) {
    return {
      method: PaymentMethod.StripeCard,
      isLink: true,
      email: method.link.email || ""
    };
  }
}

export function convertStatus(status: Stripe.Invoice.Status): PaymentStatus {
  switch (status) {
    case "draft":
      return PaymentStatus.Draft;

    case "open":
      return PaymentStatus.Pending;

    case "paid":
      return PaymentStatus.Successful;

    case "void":
      return PaymentStatus.Cancelled;

    case "uncollectible":
      return PaymentStatus.Failed;
  }
}

export async function getCustomerDataFromCompletedFlow(
  flow: CompletedPaymentFlow
): Promise<Stripe.CustomerUpdateParams> {
  const paymentMethod = await stripe.paymentMethods.retrieve(flow.mandateId);
  const address = paymentMethod.billing_details.address;

  return {
    invoice_settings: {
      default_payment_method: flow.mandateId
    },
    address: address
      ? {
          line1: address.line1 || "",
          ...(address.city && { city: address.city }),
          ...(address.country && { country: address.country }),
          ...(address.line2 && { line2: address.line2 }),
          ...(address.postal_code && { postal_code: address.postal_code }),
          ...(address.state && { state: address.state })
        }
      : null
  };
}

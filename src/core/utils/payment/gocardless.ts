import {
  ContributionPeriod,
  PaymentMethod,
  PaymentStatus
} from "@beabee/beabee-common";
import { differenceInMonths, format } from "date-fns";
import {
  SubscriptionIntervalUnit,
  PaymentCurrency,
  PaymentStatus as GCPaymentStatus,
  Subscription
} from "gocardless-nodejs/types/Types";
import moment from "moment";

import { log as mainLogger } from "#core/logging";
import gocardless from "#core/lib/gocardless";
import { PaymentForm } from "#core/utils";
import { getChargeableAmount } from "#core/utils/payment";

import config from "#config";

const log = mainLogger.child({ app: "gc-utils" });

function getGCChargeableAmount(paymentForm: PaymentForm): string {
  return getChargeableAmount(
    paymentForm,
    PaymentMethod.GoCardlessDirectDebit
  ).toString();
}

async function getNextPendingPayment(query: Record<string, unknown>) {
  // We return the first pending payment we find, so there might be one with a
  // different status that has an earlier charge date, but for our purposes that
  // is fine and this can reduce API calls
  for (const status of [
    GCPaymentStatus.PendingSubmission,
    GCPaymentStatus.Submitted,
    // This one is unlikely so can go last to reduce API calls
    GCPaymentStatus.PendingCustomerApproval
  ]) {
    const payments = await gocardless.payments.list({
      status,
      limit: 1,
      sort_field: "charge_date",
      sort_direction: "asc",
      ...query
    });
    if (payments.length > 0) {
      return payments[0];
    }
  }
}

export async function getSubscriptionNextChargeDate(
  subscription: Subscription
): Promise<Date> {
  const pendingPayment = await getNextPendingPayment({
    subscription: subscription.id,
    "charge_date[gte]": moment.utc().format("YYYY-MM-DD")
  });

  // Check for pending payments because subscription.upcoming_payments doesn't
  // include pending payments
  const date = pendingPayment
    ? pendingPayment.charge_date
    : subscription.upcoming_payments![0].charge_date;
  return moment.utc(date).add(config.gracePeriod).toDate();
}

export async function createSubscription(
  mandateId: string,
  paymentForm: PaymentForm,
  _startDate?: Date
): Promise<Subscription> {
  let startDate = _startDate && format(_startDate, "yyyy-MM-dd");
  const chargeableAmount = getGCChargeableAmount(paymentForm);
  log.info("Create subscription for " + mandateId, {
    paymentForm,
    startDate,
    chargeableAmount
  });

  if (startDate) {
    const mandate = await gocardless.mandates.get(mandateId);
    // next_possible_charge_date will always have a value as this is an active mandate
    if (startDate < mandate.next_possible_charge_date!) {
      startDate = mandate.next_possible_charge_date!;
    }
  }

  const subscription = await gocardless.subscriptions.create({
    amount: chargeableAmount,
    currency: config.currencyCode.toUpperCase(),
    interval_unit:
      paymentForm.period === ContributionPeriod.Annually
        ? SubscriptionIntervalUnit.Yearly
        : SubscriptionIntervalUnit.Monthly,
    name: "Membership",
    links: {
      mandate: mandateId
    },
    ...(startDate && { start_date: startDate })
  });

  return subscription;
}

export async function updateSubscription(
  subscriptionId: string,
  paymentForm: PaymentForm
): Promise<Subscription> {
  const chargeableAmount = getGCChargeableAmount(paymentForm);
  const subscription = await gocardless.subscriptions.get(subscriptionId);

  log.info(
    `Update subscription amount for ${subscriptionId} to ${chargeableAmount}`
  );

  // Don't update if it hasn't changed as GoCardless still counts this
  // as one of the 10 updates
  if (subscription.amount !== chargeableAmount) {
    return await gocardless.subscriptions.update(subscriptionId, {
      amount: chargeableAmount
    });
  } else {
    return subscription;
  }
}

export async function prorateSubscription(
  mandateId: string,
  renewalDate: Date,
  paymentForm: PaymentForm,
  lastMonthlyAmount: number
): Promise<boolean> {
  const monthsLeft = Math.max(0, differenceInMonths(renewalDate, new Date()));
  const prorateAmount =
    (paymentForm.monthlyAmount - lastMonthlyAmount) * monthsLeft;

  log.info("Prorate subscription for " + mandateId, {
    lastMonthlyAmount,
    paymentForm,
    monthsLeft,
    prorateAmount
  });

  if (prorateAmount >= 0) {
    // Amounts of less than 1 can't be charged, just ignore them
    if (prorateAmount < 1) {
      return true;
    } else if (paymentForm.prorate) {
      await gocardless.payments.create({
        amount: Math.floor(prorateAmount * 100).toFixed(0),
        currency: config.currencyCode.toUpperCase() as PaymentCurrency,
        description: "One-off payment to start new contribution",
        links: {
          mandate: mandateId
        }
      });
      return true;
    }
  }

  return false;
}

export async function hasPendingPayment(mandateId: string): Promise<boolean> {
  return !!(await getNextPendingPayment({ mandate: mandateId }));
}

export function convertStatus(status: GCPaymentStatus): PaymentStatus {
  switch (status) {
    case GCPaymentStatus.PendingCustomerApproval:
    case GCPaymentStatus.PendingSubmission:
    case GCPaymentStatus.Submitted:
      return PaymentStatus.Pending;

    case GCPaymentStatus.Confirmed:
    case GCPaymentStatus.PaidOut:
      return PaymentStatus.Successful;

    case GCPaymentStatus.Failed:
    case GCPaymentStatus.CustomerApprovalDenied:
      return PaymentStatus.Failed;

    case GCPaymentStatus.Cancelled:
    case GCPaymentStatus.ChargedBack:
      return PaymentStatus.Cancelled;
  }
}

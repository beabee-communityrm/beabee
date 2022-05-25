import { differenceInMonths, format } from "date-fns";
import {
  SubscriptionIntervalUnit,
  PaymentCurrency,
  PaymentStatus as GCPaymentStatus
} from "gocardless-nodejs/types/Types";
import moment from "moment";

import { log as mainLogger } from "@core/logging";
import gocardless from "@core/lib/gocardless";
import { ContributionPeriod, getActualAmount, PaymentForm } from "@core/utils";

import { PaymentStatus } from "@models/Payment";

import config from "@config";

const log = mainLogger.child({ app: "gc-utils" });

function getChargeableAmount(paymentForm: PaymentForm): number {
  const actualAmount = getActualAmount(
    paymentForm.monthlyAmount,
    paymentForm.period
  );
  const chargeableAmount = paymentForm.payFee
    ? Math.floor((actualAmount / 0.99) * 100) + 20
    : actualAmount * 100;
  return Math.round(chargeableAmount); // TODO: fix this properly
}

export async function getNextChargeDate(subscriptionId: string): Promise<Date> {
  const subscription = await gocardless.subscriptions.get(subscriptionId);
  const futurePayments = await gocardless.payments.list({
    subscription: subscription.id,
    "charge_date[gte]": moment.utc().format("YYYY-MM-DD")
  });

  return moment
    .utc(
      futurePayments.length > 0
        ? futurePayments.map((p) => p.charge_date).sort()[0]
        : subscription.upcoming_payments[0].charge_date
    )
    .add(config.gracePeriod)
    .toDate();
}

export async function createSubscription(
  mandateId: string,
  paymentForm: PaymentForm,
  _startDate?: Date
): Promise<string> {
  let startDate = _startDate && format(_startDate, "yyyy-MM-dd");
  const chargeableAmount = getChargeableAmount(paymentForm);
  log.info("Create subscription for " + mandateId, {
    paymentForm,
    startDate,
    chargeableAmount
  });

  if (startDate) {
    const mandate = await gocardless.mandates.get(mandateId);
    // next_possible_charge_date will always have a value as this is an active mandate
    if (startDate < mandate.next_possible_charge_date!) {
      startDate = mandate.next_possible_charge_date;
    }
  }

  const subscription = await gocardless.subscriptions.create({
    amount: chargeableAmount.toString(),
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

  return subscription.id;
}

export async function updateSubscription(
  subscriptionId: string,
  paymentForm: PaymentForm
) {
  const chargeableAmount = getChargeableAmount(paymentForm);

  log.info(
    `Update subscription amount for ${subscriptionId} to ${chargeableAmount}`
  );

  await gocardless.subscriptions.update(subscriptionId, {
    amount: chargeableAmount.toString()
  });
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
        amount: (prorateAmount * 100).toFixed(0),
        currency: config.currencyCode.toUpperCase() as PaymentCurrency,
        // TODO: i18n description: "One-off payment to start new contribution",
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
  for (const status of [
    GCPaymentStatus.PendingCustomerApproval,
    GCPaymentStatus.PendingSubmission,
    GCPaymentStatus.Submitted
  ]) {
    const payments = await gocardless.payments.list({
      limit: 1,
      status,
      mandate: mandateId
    });
    if (payments.length > 0) {
      return true;
    }
  }

  return false;
}

// export async function calcSubscriptionExpiryDate(
//   subscriptionId: string,
//   fromDate: string
// ): Promise<Date> {
//   const subscription = await gocardless.subscriptions.get(subscriptionId);
//   return subscription.upcoming_payments.length > 0
//     ? moment
//         .utc(subscription.upcoming_payments[0].charge_date)
//         .add(config.gracePeriod)
//         .toDate()
//     : moment.utc(fromDate).add(getSubscriptionDuration(subscription)).toDate();
// }

// export function getSubscriptionDuration({
//   interval,
//   interval_unit
// }: Subscription) {
//   const unit =
//     interval_unit === "weekly"
//       ? "weeks"
//       : interval_unit === "monthly"
//       ? "months"
//       : "years";
//   return moment.duration({ [unit]: Number(interval) });
// }

// export function getSubscriptionPeriod(
//   subscription: Subscription
// ): ContributionPeriod | null {
//   const interval = Number(subscription.interval);
//   const intervalUnit = subscription.interval_unit;
//   if (
//     (interval === 12 && intervalUnit === SubscriptionIntervalUnit.Monthly) ||
//     (interval === 1 && intervalUnit === SubscriptionIntervalUnit.Yearly)
//   )
//     return ContributionPeriod.Annually;
//   if (interval === 1 && intervalUnit === "monthly")
//     return ContributionPeriod.Monthly;

//   log.error(
//     `Unrecognised subscription period interval: ${interval} unit:${intervalUnit}`
//   );
//   return null;
// }

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

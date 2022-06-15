import {
  Payment as GCPayment,
  PaymentStatus as GCPaymentStatus,
  Subscription,
  SubscriptionIntervalUnit
} from "gocardless-nodejs/types/Types";
import moment, { DurationInputObject } from "moment";
import { getRepository } from "typeorm";

import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import { convertStatus } from "@core/utils/payment/gocardless";

import EmailService from "@core/services/EmailService";
import MembersService from "@core/services/MembersService";
import PaymentService from "@core/services/PaymentService";

import { GCPaymentData } from "@models/PaymentData";
import Payment from "@models/Payment";

import config from "@config";

const log = mainLogger.child({ app: "payment-webhook-utils" });

export async function updatePayment(
  gcPaymentId: string,
  isConfirmed: boolean = false
): Promise<void> {
  log.info("Update payment " + gcPaymentId);

  const gcPayment = await gocardless.payments.get(gcPaymentId);
  const payment = await findOrCreatePayment(gcPayment);

  if (payment) {
    payment.status = convertStatus(gcPayment.status);
    payment.description = gcPayment.description || "Unknown";
    payment.amount = Number(gcPayment.amount) / 100;
    payment.amountRefunded = Number(gcPayment.amount_refunded) / 100;
    payment.chargeDate = moment.utc(gcPayment.charge_date).toDate();

    await getRepository(Payment).save(payment);

    if (isConfirmed) {
      await confirmPayment(payment, gcPayment);
    }
  }
}

async function confirmPayment(
  payment: Payment,
  gcPayment: GCPayment
): Promise<void> {
  log.info("Confirm payment " + payment.id, {
    paymentId: payment.id,
    memberId: payment.member?.id,
    subscriptionId: payment.subscriptionId
  });

  if (!payment.member || !payment.subscriptionId) {
    log.info(
      `Ignore confirm payment for ${payment.id}, not subscription related`
    );
    return;
  }

  const gcData = (await PaymentService.getData(payment.member))
    .data as GCPaymentData;

  if (payment.subscriptionId !== gcData.subscriptionId) {
    log.error("Mismatched subscription IDs for payment " + payment.id, {
      ourSubscriptionId: payment.subscriptionId,
      gcSubscriptionId: gcPayment.links.subscription
    });
    return;
  }

  // If there's a pending amount change we assume this confirms it.  Because we
  // don't allow subscription changes while any payments are pending there can't
  // be a pending payment for the previous amount
  if (gcData.nextMonthlyAmount) {
    await PaymentService.updateDataBy(
      payment.member,
      "nextMonthlyAmount",
      null
    );
    await MembersService.updateMember(payment.member, {
      contributionMonthlyAmount: gcData.nextMonthlyAmount
    });
  }

  await MembersService.extendMemberPermission(
    payment.member,
    "member",
    await getSubscriptionPeriodEnd(payment)
  );
  // TODO: resubscribe to newsletter
}

async function getSubscriptionPeriodEnd(payment: Payment): Promise<Date> {
  const subscription = await gocardless.subscriptions.get(
    payment.subscriptionId!
  );

  // If the subscription has been cancelled there won't be any upcoming payments
  if (subscription.upcoming_payments.length > 0) {
    return moment
      .utc(subscription.upcoming_payments[0].charge_date)
      .add(config.gracePeriod)
      .toDate();
  } else {
    return moment
      .utc(payment.chargeDate)
      .add(getSubscriptionDuration(subscription))
      .toDate();
  }
}

function getSubscriptionDuration(
  subscription: Subscription
): DurationInputObject {
  const unit =
    subscription.interval_unit === SubscriptionIntervalUnit.Yearly
      ? "year"
      : subscription.interval_unit === SubscriptionIntervalUnit.Monthly
      ? "month"
      : "week";
  return {
    [unit]: Number(subscription.interval)
  };
}

export async function updatePaymentStatus(
  paymentId: string,
  gcStatus: GCPaymentStatus
): Promise<void> {
  const status = convertStatus(gcStatus);
  log.info(`Update payment status ${paymentId} to ${status}`);
  await getRepository(Payment).update({ id: paymentId }, { status });
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<void> {
  log.info("Cancel subscription " + subscriptionId);

  const data = await PaymentService.getDataBy("subscriptionId", subscriptionId);
  if (data) {
    await MembersService.cancelMemberContribution(data.member);
    await EmailService.sendTemplateToMember(
      "cancelled-contribution",
      data.member
    );
  } else {
    log.info("Unlink subscription " + subscriptionId);
  }
}

export async function cancelMandate(mandateId: string): Promise<void> {
  const data = await PaymentService.getDataBy("mandateId", mandateId);
  if (data) {
    log.info("Cancel mandate " + mandateId, {
      memberId: data.member.id,
      mandateId: (data.data as GCPaymentData).mandateId
    });

    await PaymentService.updateDataBy(data.member, "mandateId", null);
  } else {
    log.info("Unlinked mandate " + mandateId);
  }
}

async function findOrCreatePayment(
  gcPayment: GCPayment
): Promise<Payment | undefined> {
  const payment = await getRepository(Payment).findOne(gcPayment.id);
  if (payment) {
    return payment;
  }

  const data = await PaymentService.getDataBy(
    "mandateId",
    gcPayment.links.mandate
  );

  if (data) {
    log.info("Create payment " + gcPayment.id, {
      memberId: data.member.id,
      gcPaymentId: gcPayment.id
    });
    const newPayment = new Payment();
    newPayment.id = gcPayment.id;
    newPayment.member = data.member;
    if (gcPayment.links.subscription) {
      newPayment.subscriptionId = gcPayment.links.subscription;
    }
    return newPayment;
  }
}

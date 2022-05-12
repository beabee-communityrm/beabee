import {
  Payment as GCApiPayment,
  Subscription,
  SubscriptionIntervalUnit
} from "gocardless-nodejs/types/Types";
import moment, { Moment } from "moment";
import { getRepository } from "typeorm";

import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import { ContributionPeriod } from "@core/utils";

import EmailService from "@core/services/EmailService";
import MembersService from "@core/services/MembersService";
import PaymentService from "@core/services/PaymentService";

import GCPayment from "@models/GCPayment";
import GCPaymentData from "@models/GCPaymentData";

import config from "@config";

const log = mainLogger.child({ app: "payment-webhook-service" });

class GCPaymentWebhookService {
  async updatePayment(
    gcPaymentId: string,
    isConfirmed: boolean = false
  ): Promise<void> {
    log.info("Update payment " + gcPaymentId);

    const gcPayment = await gocardless.payments.get(gcPaymentId);
    let payment = await getRepository(GCPayment).findOne({
      where: { paymentId: gcPayment.id },
      relations: ["member"]
    });

    if (!payment) {
      payment = await this.createPayment(gcPayment);
    }

    payment.status = gcPayment.status;
    payment.description = gcPayment.description || "Unknown";
    payment.amount = Number(gcPayment.amount) / 100;
    payment.amountRefunded = Number(gcPayment.amount_refunded) / 100;
    payment.chargeDate = moment.utc(gcPayment.charge_date).toDate();

    await getRepository(GCPayment).save(payment);

    if (isConfirmed) {
      await this.confirmPayment(payment);
    }
  }

  private async confirmPayment(payment: GCPayment): Promise<void> {
    log.info("Confirm payment " + payment.paymentId, {
      paymentId: payment.paymentId,
      memberId: payment.member?.id,
      subscriptionId: payment.subscriptionId
    });

    if (!payment.member || !payment.subscriptionId) {
      log.info("Ignore confirm payment for " + payment.paymentId);
      return;
    }

    const gcData = await PaymentService.getPaymentData(payment.member);
    if (!gcData) {
      log.error("Member has no GC data but confirmed payments");
      return;
    }

    if (payment.member.nextContributionMonthlyAmount) {
      const newAmount = this.getSubscriptionAmount(
        payment,
        // TODO: wrong type
        !!(gcData.data as GCPaymentData).payFee
      );
      if (newAmount === payment.member.nextContributionMonthlyAmount) {
        await MembersService.updateMember(payment.member, {
          contributionMonthlyAmount: newAmount,
          nextContributionMonthlyAmount: null
        });
      }
    }

    const nextExpiryDate = await this.calcPaymentExpiryDate(payment);
    await MembersService.extendMemberPermission(
      payment.member,
      "member",
      nextExpiryDate.toDate()
    );
    // TODO: resubscribe to newsletter
  }

  async updatePaymentStatus(
    gcPaymentId: string,
    status: string
  ): Promise<void> {
    log.info(`Update payment status ${gcPaymentId} to ${status}`);
    await getRepository(GCPayment).update(
      { paymentId: gcPaymentId },
      { status }
    );
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    log.info("Cancel subscription " + subscriptionId);

    const gcData = await getRepository(GCPaymentData).findOne({
      where: { subscriptionId },
      relations: ["member"]
    });
    if (gcData) {
      await MembersService.cancelMemberContribution(gcData.member);
      await EmailService.sendTemplateToMember(
        "cancelled-contribution",
        gcData.member
      );
    } else {
      log.info("Unlink subscription " + subscriptionId);
    }
  }

  async cancelMandate(mandateId: string): Promise<void> {
    const gcData = (await getRepository(GCPaymentData).findOne({
      where: { mandateId },
      loadRelationIds: true
    })) as unknown as WithRelationIds<GCPaymentData, "member">;

    if (gcData) {
      log.info("Cancel mandate " + mandateId, {
        memberId: gcData.member,
        mandateId: gcData.mandateId
      });

      await getRepository(GCPaymentData).update(gcData.member, {
        mandateId: null
      });
    } else {
      log.info("Unlinked mandate " + mandateId);
    }
  }

  private async calcPaymentExpiryDate(payment: GCPayment): Promise<Moment> {
    if (payment.subscriptionId) {
      const subscription = await gocardless.subscriptions.get(
        payment.subscriptionId
      );
      return subscription.upcoming_payments.length > 0
        ? moment
            .utc(subscription.upcoming_payments[0].charge_date)
            .add(config.gracePeriod)
        : moment
            .utc(payment.chargeDate)
            .add(this.getSubscriptionDuration(subscription));
    } else {
      return moment.utc();
    }
  }

  private async createPayment(gcApiPayment: GCApiPayment): Promise<GCPayment> {
    const payment = new GCPayment();
    payment.paymentId = gcApiPayment.id;

    const gcData = await getRepository(GCPaymentData).findOne({
      where: { mandateId: gcApiPayment.links.mandate },
      relations: ["member"]
    });
    if (gcData) {
      log.info("Create payment " + gcApiPayment.id, {
        memberId: gcData.member.id,
        gcPaymentId: gcApiPayment.id
      });
      payment.member = gcData.member;
    } else {
      log.info("Create unlinked payment " + gcApiPayment.id);
    }

    if (gcApiPayment.links.subscription) {
      const subscription = await gocardless.subscriptions.get(
        gcApiPayment.links.subscription
      );
      payment.subscriptionId = gcApiPayment.links.subscription;
      payment.subscriptionPeriod = this.getSubscriptionPeriod(subscription);
    }

    return payment;
  }

  private getSubscriptionPeriod(
    subscription: Subscription
  ): ContributionPeriod | null {
    const interval = Number(subscription.interval);
    const intervalUnit = subscription.interval_unit;
    if (
      (interval === 12 && intervalUnit === SubscriptionIntervalUnit.Monthly) ||
      (interval === 1 && intervalUnit === SubscriptionIntervalUnit.Yearly)
    )
      return ContributionPeriod.Annually;
    if (interval === 1 && intervalUnit === "monthly")
      return ContributionPeriod.Monthly;

    log.error(
      `Unrecognised subscription period interval: ${interval} unit:${intervalUnit}`
    );
    return null;
  }

  private getSubscriptionDuration({ interval, interval_unit }: Subscription) {
    const unit =
      interval_unit === "weekly"
        ? "weeks"
        : interval_unit === "monthly"
        ? "months"
        : "years";
    return moment.duration({ [unit]: Number(interval) });
  }

  private getSubscriptionAmount(payment: GCPayment, payFee: boolean): number {
    const amount =
      payment.amount /
      (payment.subscriptionPeriod === ContributionPeriod.Annually ? 12 : 1);
    return payFee ? Math.round(100 * (amount - 0.2) * 0.99) / 100 : amount;
  }
}

export default new GCPaymentWebhookService();

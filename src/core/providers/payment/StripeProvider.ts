import { add } from "date-fns";
import Stripe from "stripe";

import { PaymentProvider, UpdateContributionResult } from ".";
import { CompletedPaymentFlow } from "@core/providers/payment-flow";

import stripe from "@core/lib/stripe";
import { log as mainLogger } from "@core/logging";
import { ContributionInfo, getActualAmount, PaymentForm } from "@core/utils";
import { calcRenewalDate, getChargeableAmount } from "@core/utils/payment";
import {
  createSubscription,
  manadateToSource,
  updateSubscription
} from "@core/utils/payment/stripe";

import Member from "@models/Member";
import { StripePaymentData } from "@models/PaymentData";

import NoPaymentMethod from "@api/errors/NoPaymentMethod";

import config from "@config";

const log = mainLogger.child({ app: "stripe-payment-provider" });

export default class StripeProvider extends PaymentProvider<StripePaymentData> {
  async canChangeContribution(useExistingMandate: boolean): Promise<boolean> {
    return !useExistingMandate || !!this.data.mandateId;
  }

  async getContributionInfo(): Promise<Partial<ContributionInfo>> {
    const paymentSource = this.data.mandateId
      ? await manadateToSource(this.data.mandateId)
      : undefined;

    return {
      payFee: !!this.data.payFee,
      // TODO hasPendingPayment: await this.hasPendingPayment(),
      ...(paymentSource && { paymentSource }),
      ...(this.data.cancelledAt && { cancellationDate: this.data.cancelledAt }),
      ...(this.data.nextAmount &&
        this.member.contributionPeriod && {
          nextAmount: getActualAmount(
            this.data.nextAmount.monthly,
            this.member.contributionPeriod
          )
        })
    };
  }

  async cancelContribution(keepMandate: boolean): Promise<void> {
    if (this.data.mandateId && !keepMandate) {
      await stripe.paymentMethods.detach(this.data.mandateId);
      this.data.mandateId = null;
    }
    if (this.data.subscriptionId) {
      await stripe.subscriptions.del(this.data.subscriptionId);
      this.data.subscriptionId = null;
    }
    this.data.cancelledAt = new Date();
    this.data.nextAmount = null;

    await this.updateData();
  }

  async updatePaymentMethod(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    if (this.data.customerId) {
      log.info("Attach new payment source to " + this.data.customerId);
      await stripe.paymentMethods.attach(completedPaymentFlow.mandateId, {
        customer: this.data.customerId
      });
      await stripe.customers.update(this.data.customerId, {
        invoice_settings: {
          default_payment_method: completedPaymentFlow.mandateId
        }
      });
    } else {
      log.info("Create new customer");
      const customer = await stripe.customers.create({
        email: this.member.email,
        name: `${this.member.firstname} ${this.member.lastname}`,
        payment_method: completedPaymentFlow.mandateId,
        invoice_settings: {
          default_payment_method: completedPaymentFlow.mandateId
        }
      });
      this.data.customerId = customer.id;
    }

    if (this.data.mandateId) {
      log.info("Detach old payment method " + this.data.mandateId);
      await stripe.paymentMethods.detach(this.data.mandateId);
    }

    this.data.mandateId = completedPaymentFlow.mandateId;

    await this.updateData();
  }

  async updateContribution(
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult> {
    if (!this.data.customerId || !this.data.mandateId) {
      throw new NoPaymentMethod();
    }

    let subscription: Stripe.Subscription | undefined;
    let startNow = true;

    if (this.data.subscriptionId) {
      if (this.member.membership?.isActive) {
        log.info("Update subscription");
        const result = await updateSubscription(
          this.data.subscriptionId,
          paymentForm,
          this.method
        );
        subscription = result.subscription;
        startNow = result.startNow;
      } else {
        await this.cancelContribution(true);
      }
    }

    if (!subscription) {
      log.info("Create subscription");
      subscription = await createSubscription(
        this.data.customerId,
        paymentForm,
        this.method,
        calcRenewalDate(this.member)
      );
    }

    this.data.subscriptionId = subscription.id;
    this.data.payFee = paymentForm.payFee;
    this.data.cancelledAt = null;
    this.data.nextAmount = startNow
      ? null
      : {
          chargeable: getChargeableAmount(paymentForm, this.method),
          monthly: paymentForm.monthlyAmount
        };

    await this.updateData();

    return {
      startNow,
      expiryDate: add(
        new Date(subscription.current_period_end * 1000),
        config.gracePeriod
      )
    };
  }

  async updateMember(updates: Partial<Member>): Promise<void> {
    if (
      (updates.email || updates.firstname || updates.lastname) &&
      this.data.customerId
    ) {
      log.info("Update member");
      await stripe.customers.update(this.data.customerId, {
        ...(updates.email && { email: updates.email }),
        ...((updates.firstname || updates.lastname) && {
          name: `${updates.firstname} ${updates.lastname}`
        })
      });
    }
  }

  async permanentlyDeleteMember(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

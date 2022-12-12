import { ContributionType } from "@beabee/beabee-common";
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
  deleteSubscription,
  manadateToSource,
  updateSubscription
} from "@core/utils/payment/stripe";

import Contact from "@models/Contact";
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
        this.contact.contributionPeriod && {
          nextAmount: getActualAmount(
            this.data.nextAmount.monthly,
            this.contact.contributionPeriod
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
      await deleteSubscription(this.data.subscriptionId);
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
        email: this.contact.email,
        name: `${this.contact.firstname} ${this.contact.lastname}`,
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

    // Manual contributors don't have a real subscription yet, create one on
    // their previous amount so Stripe can automatically handle any proration
    if (
      this.contact.membership?.isActive &&
      this.contact.contributionType === ContributionType.Manual
    ) {
      log.info("Creating new subscription for manual contributor");
      const newSubscription = await createSubscription(
        this.data.customerId,
        {
          ...paymentForm,
          monthlyAmount: this.contact.contributionMonthlyAmount || 0
        },
        this.method,
        calcRenewalDate(this.contact)
      );
      this.data.subscriptionId = newSubscription.id;
    }

    const { subscription, startNow } = await this.updateOrCreateContribution(
      paymentForm
    );

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

  private async updateOrCreateContribution(
    paymentForm: PaymentForm
  ): Promise<{ subscription: Stripe.Subscription; startNow: boolean }> {
    if (this.data.subscriptionId && this.contact.membership?.isActive) {
      log.info("Update subscription " + this.data.subscriptionId);
      return await updateSubscription(
        this.data.subscriptionId,
        paymentForm,
        this.method
      );
    } else {
      // Cancel any existing (failing) subscriptions
      await this.cancelContribution(true);

      log.info("Create subscription");
      const subscription = await createSubscription(
        this.data.customerId!, // customerId is asserted in updateContribution
        paymentForm,
        this.method,
        calcRenewalDate(this.contact)
      );
      return { subscription, startNow: true };
    }
  }

  async updateContact(updates: Partial<Contact>): Promise<void> {
    if (
      (updates.email || updates.firstname || updates.lastname) &&
      this.data.customerId
    ) {
      log.info("Update contact");
      await stripe.customers.update(this.data.customerId, {
        ...(updates.email && { email: updates.email }),
        ...((updates.firstname || updates.lastname) && {
          name: `${updates.firstname} ${updates.lastname}`
        })
      });
    }
  }

  async permanentlyDeleteContact(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

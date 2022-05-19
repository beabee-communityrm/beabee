import Stripe from "stripe";

import { PaymentProvider, UpdateContributionResult } from ".";
import { CompletedPaymentFlow } from "@core/providers/payment-flow";

import stripe from "@core/lib/stripe";
import { log as mainLogger } from "@core/logging";
import {
  ContributionInfo,
  PaymentForm,
  PaymentMethod,
  PaymentSource
} from "@core/utils";
import { calcMonthsLeft, calcRenewalDate } from "@core/utils/payment";
import {
  createSubscription,
  updateSubscription
} from "@core/utils/payment/stripe";

import Member from "@models/Member";
import Payment from "@models/Payment";
import { StripePaymentData } from "@models/PaymentData";

import NoPaymentSource from "@api/errors/NoPaymentSource";

const log = mainLogger.child({ app: "stripe-payment-provider" });

export default class StripeProvider extends PaymentProvider<StripePaymentData> {
  async getPayments(): Promise<Payment[]> {
    throw new Error("Method not implemented.");
  }
  async canChangeContribution(useExistingMandate: boolean): Promise<boolean> {
    return true;
  }

  async getContributionInfo(): Promise<Partial<ContributionInfo> | undefined> {
    let paymentSource: PaymentSource | undefined;

    if (this.data.mandateId) {
      const paymentMethod = await stripe.paymentMethods.retrieve(
        this.data.mandateId
      );
      if (paymentMethod.type === "card" && paymentMethod.card) {
        paymentSource = {
          type: PaymentMethod.Card,
          last4: paymentMethod.card.last4,
          expiryMonth: paymentMethod.card.exp_month,
          expiryYear: paymentMethod.card.exp_year
        };
      }
    }

    return {
      payFee: !!this.data.payFee,
      hasPendingPayment: await this.hasPendingPayment(),
      ...(paymentSource && { paymentSource }),
      ...(this.data.cancelledAt && { cancellationDate: this.data.cancelledAt })
    };
  }

  async hasPendingPayment(): Promise<boolean> {
    return false; // TODO
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

    await this.updateData();
  }

  async updatePaymentSource(
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

    // TODO: cancel old paymentMethod?
    this.data.mandateId = completedPaymentFlow.mandateId;

    await this.updateData();
  }

  async updateContribution(
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult> {
    if (!this.data.customerId || !this.data.mandateId) {
      throw new NoPaymentSource();
    }

    let subscription: Stripe.Subscription | undefined;

    if (this.data.subscriptionId) {
      if (this.member.membership?.isActive) {
        log.info("Update subscription");
        subscription = await updateSubscription(
          this.member,
          this.data.subscriptionId,
          paymentForm
        );
      } else {
        await this.cancelContribution(true);
        // This happens in cancelContribution anyway but is here for clarity
        this.data.subscriptionId = null;
      }
    }

    if (!subscription) {
      log.info("Create subscription");
      subscription = await createSubscription(
        this.data.customerId,
        paymentForm,
        calcRenewalDate(this.member)
      );
    }

    this.data.subscriptionId = subscription.id;
    this.data.payFee = paymentForm.payFee;

    await this.updateData();

    return {
      // TODO
      startNow: calcMonthsLeft(this.member) === 0 || paymentForm.prorate,
      expiryDate: new Date(subscription.current_period_end)
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

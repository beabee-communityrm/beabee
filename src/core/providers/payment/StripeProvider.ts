import { add } from "date-fns";
import Stripe from "stripe";

import { PaymentProvider, UpdateContributionResult } from ".";
import { CompletedPaymentFlow } from "@core/providers/payment-flow";

import stripe from "@core/lib/stripe";
import { log as mainLogger } from "@core/logging";
import { ContributionInfo, PaymentForm, PaymentSource } from "@core/utils";
import { calcRenewalDate } from "@core/utils/payment";
import {
  createSubscription,
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
    let paymentSource: PaymentSource | undefined;

    if (this.data.mandateId) {
      const paymentMethod = await stripe.paymentMethods.retrieve(
        this.data.mandateId,
        { expand: ["customer"] }
      );
      if (paymentMethod.type === "card" && paymentMethod.card) {
        paymentSource = {
          type: "card",
          last4: paymentMethod.card.last4,
          expiryMonth: paymentMethod.card.exp_month,
          expiryYear: paymentMethod.card.exp_year
        };
      } else if (
        paymentMethod.type === "sepa_debit" &&
        paymentMethod.sepa_debit
      ) {
        paymentSource = {
          type: "direct-debit",
          bankName: paymentMethod.sepa_debit.bank_code || "",
          accountHolderName:
            (paymentMethod.customer as Stripe.Customer).name || "",
          accountNumberEnding: paymentMethod.sepa_debit.last4 || ""
        };
      }
    }

    return {
      payFee: !!this.data.payFee,
      // TODO hasPendingPayment: await this.hasPendingPayment(),
      ...(paymentSource && { paymentSource }),
      ...(this.data.cancelledAt && { cancellationDate: this.data.cancelledAt })
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
          paymentForm
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
        calcRenewalDate(this.member)
      );
    }

    this.data.subscriptionId = subscription.id;
    this.data.payFee = paymentForm.payFee;
    this.data.cancelledAt = null;

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

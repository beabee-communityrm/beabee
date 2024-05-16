import { ContributionType, PaymentSource } from "@beabee/beabee-common";
import { add } from "date-fns";
import Stripe from "stripe";

import { stripe } from "@core/lib/stripe";
import { log as mainLogger } from "@core/logging";
import { calcRenewalDate } from "@core/utils/payment";
import {
  createSubscription,
  deleteSubscription,
  getCustomerDataFromCompletedFlow,
  manadateToSource,
  updateSubscription
} from "@core/utils/payment/stripe";

import Contact from "@models/Contact";

import NoPaymentMethod from "@api/errors/NoPaymentMethod";

import { PaymentProvider } from ".";

import config from "@config";

import {
  CompletedPaymentFlow,
  ContributionInfo,
  PaymentForm,
  UpdateContributionResult,
  UpdatePaymentMethodResult
} from "@type/index";

const log = mainLogger.child({ app: "stripe-payment-provider" });

export default class StripeProvider extends PaymentProvider {
  async canChangeContribution(useExistingMandate: boolean): Promise<boolean> {
    return !useExistingMandate || !!this.data.mandateId;
  }

  async getContributionInfo(): Promise<Partial<ContributionInfo>> {
    let paymentSource: PaymentSource | undefined;
    try {
      paymentSource = this.data.mandateId
        ? await manadateToSource(this.data.mandateId)
        : undefined;
    } catch (err) {
      // 404s can happen on dev as we don't use real mandate IDs
      if (
        !(
          config.dev &&
          err instanceof Stripe.errors.StripeInvalidRequestError &&
          err.statusCode === 404
        )
      ) {
        throw err;
      }
    }

    return {
      // TODO hasPendingPayment: await this.hasPendingPayment(),
      ...(paymentSource && { paymentSource })
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
    this.data.nextAmount = null;

    await this.updateData();
  }

  async updatePaymentMethod(
    flow: CompletedPaymentFlow
  ): Promise<UpdatePaymentMethodResult> {
    const customerData = await getCustomerDataFromCompletedFlow(flow);
    let customerId = this.data.customerId;

    // Attach payment method to existing customer
    if (customerId) {
      log.info("Attach new payment source to " + customerId);
      await stripe.paymentMethods.attach(flow.mandateId, {
        customer: customerId
      });
      await stripe.customers.update(customerId, customerData);
    }
    // Create a new customer
    else {
      log.info("Create new customer");
      const customer = await stripe.customers.create({
        email: this.contact.email,
        name: `${this.contact.firstname} ${this.contact.lastname}`,
        payment_method: flow.mandateId,
        //  TODO: add VAT number support again
        // ...(flow.joinForm.vatNumber && {
        //   tax_id_data: [
        //     {
        //       type: "eu_vat",
        //       value: flow.joinForm.vatNumber
        //     }
        //   ]
        // }),
        ...customerData
      });
      customerId = customer.id;
    }

    if (this.data.mandateId) {
      log.info("Detach old payment method " + this.data.mandateId);
      await stripe.paymentMethods.detach(this.data.mandateId);
    }

    this.data.mandateId = flow.mandateId;

    return { customerId };
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
          monthlyAmount: this.data.monthlyAmount || 0
        },
        this.method,
        calcRenewalDate(this.contact)
      );
      // Set this for the updateOrCreateContribution call below
      this.data.subscriptionId = newSubscription.id;
    }

    const { subscription, startNow } =
      await this.updateOrCreateContribution(paymentForm);

    return {
      startNow,
      expiryDate: add(
        new Date(subscription.current_period_end * 1000),
        config.gracePeriod
      ),
      subscriptionId: subscription.id
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
    if (this.data.customerId) {
      await stripe.customers.del(this.data.customerId);
    }
  }
}

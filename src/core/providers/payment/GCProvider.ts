import { PaymentMethod } from "@beabee/beabee-common";
import { Subscription } from "gocardless-nodejs";

import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import {
  ContributionInfo,
  getActualAmount,
  PaymentForm,
  PaymentSource
} from "@core/utils";
import {
  updateSubscription,
  createSubscription,
  prorateSubscription,
  hasPendingPayment,
  getSubscriptionNextChargeDate
} from "@core/utils/payment/gocardless";
import { calcRenewalDate } from "@core/utils/payment";

import { PaymentProvider, UpdateContributionResult } from ".";
import { CompletedPaymentFlow } from "@core/providers/payment-flow";

import Contact from "@models/Contact";
import { GCPaymentData } from "@models/PaymentData";

import NoPaymentMethod from "@api/errors/NoPaymentMethod";

import config from "@config";

const log = mainLogger.child({ app: "gc-payment-provider" });

export default class GCProvider extends PaymentProvider<GCPaymentData> {
  async getContributionInfo(): Promise<Partial<ContributionInfo>> {
    let paymentSource: PaymentSource | undefined;
    let pendingPayment = false;

    if (this.data.mandateId) {
      try {
        const mandate = await gocardless.mandates.get(this.data.mandateId);
        const bankAccount = await gocardless.customerBankAccounts.get(
          mandate.links!.customer_bank_account!
        );

        paymentSource = {
          method: PaymentMethod.GoCardlessDirectDebit,
          bankName: bankAccount.bank_name || "",
          accountHolderName: bankAccount.account_holder_name || "",
          accountNumberEnding: bankAccount.account_number_ending || ""
        };
        pendingPayment = await hasPendingPayment(this.data.mandateId);
      } catch (err: any) {
        // 404s can happen on dev as we don't use real mandate IDs
        if (!(config.dev && err.response && err.response.status === 404)) {
          throw err;
        }
      }
    }

    return {
      payFee: this.data.payFee || false,
      hasPendingPayment: pendingPayment,
      ...(this.data.nextMonthlyAmount &&
        this.contact.contributionPeriod && {
          nextAmount: getActualAmount(
            this.data.nextMonthlyAmount,
            this.contact.contributionPeriod
          )
        }),
      ...(paymentSource && { paymentSource })
    };
  }

  async canChangeContribution(useExistingMandate: boolean): Promise<boolean> {
    // No payment method available
    if (useExistingMandate && !this.data.mandateId) {
      return false;
    }

    // Can always change contribution if there is no subscription
    if (!this.data.subscriptionId) {
      return true;
    }

    // Monthly contributors can update their contribution even if they have
    // pending payments, but they can't always change their mandate as this can
    // result in double charging
    return (
      (useExistingMandate && this.contact.contributionPeriod === "monthly") ||
      !(this.data.mandateId && (await hasPendingPayment(this.data.mandateId)))
    );
  }

  async updateContribution(
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult> {
    log.info("Update contribution for " + this.contact.id, {
      userId: this.contact.id,
      paymentForm
    });

    if (!this.data.mandateId) {
      throw new NoPaymentMethod();
    }

    let subscription: Subscription | undefined;

    if (this.data.subscriptionId) {
      if (this.contact.membership?.isActive) {
        subscription = await updateSubscription(
          this.data.subscriptionId,
          paymentForm
        );
      } else {
        // Cancel failed subscriptions, we'll try a new one
        await this.cancelContribution(true);
      }
    }

    const renewalDate = calcRenewalDate(this.contact);

    if (!subscription) {
      log.info("Creating new subscription");
      subscription = await createSubscription(
        this.data.mandateId,
        paymentForm,
        renewalDate
      );
    }

    const startNow =
      !renewalDate ||
      (await prorateSubscription(
        this.data.mandateId,
        renewalDate,
        paymentForm,
        this.contact.contributionMonthlyAmount || 0
      ));

    const expiryDate = await getSubscriptionNextChargeDate(subscription);

    log.info("Activate contribution for " + this.contact.id, {
      userId: this.contact.id,
      paymentForm,
      startNow,
      expiryDate
    });

    this.data.subscriptionId = subscription.id!;
    this.data.payFee = paymentForm.payFee;
    this.data.nextMonthlyAmount = startNow ? null : paymentForm.monthlyAmount;

    await this.updateData();

    return { startNow, expiryDate };
  }

  async cancelContribution(keepMandate: boolean): Promise<void> {
    log.info("Cancel subscription for " + this.contact.id, { keepMandate });

    const subscriptionId = this.data.subscriptionId;
    const mandateId = this.data.mandateId;

    this.data.nextMonthlyAmount = null;
    this.data.subscriptionId = null;
    if (!keepMandate) {
      this.data.mandateId = null;
    }
    // Save before cancelling to stop the webhook triggering a cancelled email
    await this.updateData();

    if (mandateId && !keepMandate) {
      await gocardless.mandates.cancel(mandateId);
    }
    if (subscriptionId) {
      await gocardless.subscriptions.cancel(subscriptionId);
    }
  }

  async updatePaymentMethod(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    log.info("Update payment source for " + this.contact.id, {
      userId: this.contact.id,
      data: this.data,
      completedPaymentFlow
    });

    const hadSubscription = !!this.data.subscriptionId;
    const mandateId = this.data.mandateId;

    this.data.subscriptionId = null;
    this.data.customerId = completedPaymentFlow.customerId;
    this.data.mandateId = completedPaymentFlow.mandateId;

    // Save before cancelling to stop the webhook triggering a cancelled email
    await this.updateData();

    if (mandateId) {
      // This will also cancel the subscription
      await gocardless.mandates.cancel(mandateId);
    }

    if (
      hadSubscription &&
      this.contact.contributionPeriod &&
      this.contact.contributionMonthlyAmount
    ) {
      await this.updateContribution({
        monthlyAmount: this.contact.contributionMonthlyAmount,
        period: this.contact.contributionPeriod,
        payFee: !!this.data.payFee,
        prorate: false
      });
    }
  }

  async updateContact(updates: Partial<Contact>): Promise<void> {
    if (
      (updates.email || updates.firstname || updates.lastname) &&
      this.data.customerId
    ) {
      log.info("Update contact in GoCardless");
      await gocardless.customers.update(this.data.customerId, {
        ...(updates.email && { email: updates.email }),
        ...(updates.firstname && { given_name: updates.firstname }),
        ...(updates.lastname && { family_name: updates.lastname })
      });
    }
  }
  async permanentlyDeleteContact(): Promise<void> {
    if (this.data.mandateId) {
      await gocardless.mandates.cancel(this.data.mandateId);
    }
    if (this.data.customerId) {
      await gocardless.customers.remove(this.data.customerId);
    }
  }
}

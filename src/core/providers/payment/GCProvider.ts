import {
  ContributionPeriod,
  PaymentMethod,
  PaymentSource
} from "@beabee/beabee-common";
import { Subscription } from "gocardless-nodejs";
import moment from "moment";

import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import {
  updateSubscription,
  createSubscription,
  prorateSubscription,
  hasPendingPayment
} from "@core/utils/payment/gocardless";
import { calcRenewalDate } from "@core/utils/payment";

import NoPaymentMethod from "@api/errors/NoPaymentMethod";

import { PaymentProvider } from ".";

import Contact from "@models/Contact";

import config from "@config";

import {
  CompletedPaymentFlow,
  ContributionInfo,
  PaymentForm,
  UpdateContributionResult,
  UpdatePaymentMethodResult
} from "@type/index";

const log = mainLogger.child({ app: "gc-payment-provider" });

export default class GCProvider extends PaymentProvider {
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
      hasPendingPayment: pendingPayment,
      ...(paymentSource && { paymentSource })
    };
  }

  async canChangeContribution(
    useExistingMandate: boolean,
    paymentForm: PaymentForm
  ): Promise<boolean> {
    // No payment method available
    if (useExistingMandate && !this.data.mandateId) {
      return false;
    }

    // Can always change contribution if there is no subscription
    if (!this.data.subscriptionId) {
      return true;
    }

    // Monthly contributors can update their contribution amount even if they have
    // pending payments, but they can't always change their period or mandate as this can
    // result in double charging
    return (
      (useExistingMandate &&
        this.data.period === ContributionPeriod.Monthly &&
        paymentForm.period === ContributionPeriod.Monthly) ||
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
      if (
        this.contact.membership?.isActive &&
        this.data.period === paymentForm.period
      ) {
        subscription = await updateSubscription(
          this.data.subscriptionId,
          paymentForm
        );
      } else {
        // Cancel failed subscriptions or when period is changing
        await this.cancelContribution(true);
      }
    }

    const renewalDate = calcRenewalDate(this.contact);
    let expiryDate;

    if (subscription) {
      expiryDate = subscription.upcoming_payments![0].charge_date;
    } else {
      log.info("Creating new subscription");
      subscription = await createSubscription(
        this.data.mandateId,
        paymentForm,
        renewalDate
      );
      // The second payment is the first renewal payment when you first create a subscription
      expiryDate = subscription.upcoming_payments![1].charge_date;
    }

    const startNow =
      !renewalDate ||
      (await prorateSubscription(
        this.data.mandateId,
        renewalDate,
        paymentForm,
        this.contact.contributionMonthlyAmount || 0
      ));

    log.info("Activate contribution for " + this.contact.id, {
      userId: this.contact.id,
      paymentForm,
      startNow,
      expiryDate
    });

    return {
      startNow,
      expiryDate: moment.utc(expiryDate).toDate(),
      subscriptionId: subscription.id!
    };
  }

  async cancelContribution(keepMandate: boolean): Promise<void> {
    log.info("Cancel subscription for " + this.contact.id, { keepMandate });

    const subscriptionId = this.data.subscriptionId;
    const mandateId = this.data.mandateId;

    this.data.nextAmount = null;
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
  ): Promise<UpdatePaymentMethodResult> {
    log.info("Update payment source for " + this.contact.id, {
      data: this.data,
      completedPaymentFlow
    });

    const hadSubscription = !!this.data.subscriptionId;
    const mandateId = this.data.mandateId;

    if (mandateId) {
      // This will also cancel the subscription
      await gocardless.mandates.cancel(mandateId);
    }

    // Recreate the subscription if the user had one
    if (hadSubscription && this.data.period && this.data.monthlyAmount) {
      const res = await this.updateContribution({
        monthlyAmount: this.data.monthlyAmount,
        period: this.data.period,
        payFee: !!this.data.payFee,
        prorate: false
      });
      return { subscriptionId: res.subscriptionId };
    } else {
      return {};
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

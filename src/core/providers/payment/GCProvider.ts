import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import {
  ContributionInfo,
  getActualAmount,
  PaymentForm,
  PaymentMethod,
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

import Member from "@models/Member";
import { GCPaymentData } from "@models/PaymentData";

import NoPaymentMethod from "@api/errors/NoPaymentMethod";

import config from "@config";
import { Subscription } from "gocardless-nodejs";

const log = mainLogger.child({ app: "gc-payment-provider" });

export default class GCProvider extends PaymentProvider<GCPaymentData> {
  async getContributionInfo(): Promise<Partial<ContributionInfo>> {
    let paymentSource: PaymentSource | undefined;
    let pendingPayment = false;

    if (this.data.mandateId) {
      try {
        const mandate = await gocardless.mandates.get(this.data.mandateId);
        const bankAccount = await gocardless.customerBankAccounts.get(
          mandate.links.customer_bank_account
        );

        paymentSource = {
          method: PaymentMethod.GoCardlessDirectDebit,
          bankName: bankAccount.bank_name,
          accountHolderName: bankAccount.account_holder_name,
          accountNumberEnding: bankAccount.account_number_ending
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
        this.member.contributionPeriod && {
          nextAmount: getActualAmount(
            this.data.nextMonthlyAmount,
            this.member.contributionPeriod
          )
        }),
      ...(paymentSource && { paymentSource }),
      ...(this.data.cancelledAt && { cancellationDate: this.data.cancelledAt })
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
      (useExistingMandate && this.member.contributionPeriod === "monthly") ||
      !(this.data.mandateId && (await hasPendingPayment(this.data.mandateId)))
    );
  }

  async updateContribution(
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult> {
    log.info("Update contribution for " + this.member.id, {
      userId: this.member.id,
      paymentForm
    });

    if (!this.data.mandateId) {
      throw new NoPaymentMethod();
    }

    let subscription: Subscription | undefined;

    if (this.data.subscriptionId) {
      if (this.member.membership?.isActive) {
        subscription = await updateSubscription(
          this.data.subscriptionId,
          paymentForm
        );
      } else {
        // Cancel failed subscriptions, we'll try a new one
        await this.cancelContribution(true);
      }
    }

    const renewalDate = calcRenewalDate(this.member);

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
        this.member.contributionMonthlyAmount || 0
      ));

    const expiryDate = await getSubscriptionNextChargeDate(subscription);

    log.info("Activate contribution for " + this.member.id, {
      userId: this.member.id,
      paymentForm,
      startNow,
      expiryDate
    });

    this.data.cancelledAt = null;
    this.data.subscriptionId = subscription.id;
    this.data.payFee = paymentForm.payFee;
    this.data.nextMonthlyAmount = startNow ? null : paymentForm.monthlyAmount;

    await this.updateData();

    return { startNow, expiryDate };
  }

  async cancelContribution(keepMandate: boolean): Promise<void> {
    log.info("Cancel subscription for " + this.member.id, { keepMandate });

    const subscriptionId = this.data.subscriptionId;
    const mandateId = this.data.mandateId;

    this.data.nextMonthlyAmount = null;
    this.data.subscriptionId = null;
    this.data.cancelledAt = new Date();
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
    log.info("Update payment source for " + this.member.id, {
      userId: this.member.id,
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
      this.member.contributionPeriod &&
      this.member.contributionMonthlyAmount
    ) {
      await this.updateContribution({
        monthlyAmount: this.member.contributionMonthlyAmount,
        period: this.member.contributionPeriod,
        payFee: !!this.data.payFee,
        prorate: false
      });
    }
  }

  async updateMember(updates: Partial<Member>): Promise<void> {
    if (
      (updates.email || updates.firstname || updates.lastname) &&
      this.data.customerId
    ) {
      log.info("Update member in GoCardless");
      await gocardless.customers.update(this.data.customerId, {
        ...(updates.email && { email: updates.email }),
        ...(updates.firstname && { given_name: updates.firstname }),
        ...(updates.lastname && { family_name: updates.lastname })
      });
    }
  }
  async permanentlyDeleteMember(): Promise<void> {
    if (this.data.mandateId) {
      await gocardless.mandates.cancel(this.data.mandateId);
    }
    if (this.data.customerId) {
      await gocardless.customers.remove(this.data.customerId);
    }
  }
}

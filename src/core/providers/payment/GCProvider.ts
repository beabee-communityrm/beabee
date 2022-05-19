import { getRepository } from "typeorm";

import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import {
  ContributionInfo,
  PaymentForm,
  PaymentMethod,
  PaymentSource
} from "@core/utils";
import {
  updateSubscription,
  createSubscription,
  prorateSubscription,
  getNextChargeDate
} from "@core/utils/payment/gocardless";
import { calcRenewalDate } from "@core/utils/payment";

import { PaymentProvider, UpdateContributionResult } from ".";
import { CompletedPaymentFlow } from "@core/providers/payment-flow";

import GCPayment from "@models/GCPayment";
import Member from "@models/Member";
import Payment from "@models/Payment";
import { GCPaymentData } from "@models/PaymentData";

import NoPaymentSource from "@api/errors/NoPaymentSource";

import config from "@config";

const log = mainLogger.child({ app: "gc-payment-provider" });

export default class GCProvider extends PaymentProvider<GCPaymentData> {
  async getContributionInfo(): Promise<Partial<ContributionInfo> | undefined> {
    let paymentSource: PaymentSource | undefined;

    if (this.data.mandateId) {
      try {
        const mandate = await gocardless.mandates.get(this.data.mandateId);
        const bankAccount = await gocardless.customerBankAccounts.get(
          mandate.links.customer_bank_account
        );

        paymentSource = {
          type: PaymentMethod.DirectDebit,
          bankName: bankAccount.bank_name,
          accountHolderName: bankAccount.account_holder_name,
          accountNumberEnding: bankAccount.account_number_ending
        };
      } catch (err: any) {
        // 404s can happen on dev as we don't use real mandate IDs
        if (!(config.dev && err.response && err.response.status === 404)) {
          throw err;
        }
      }
    }

    return {
      payFee: this.data.payFee || false,
      hasPendingPayment: await this.hasPendingPayment(),
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
      !(await this.hasPendingPayment())
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
      throw new NoPaymentSource();
    }

    if (this.data.subscriptionId) {
      if (this.member.membership?.isActive) {
        await updateSubscription(
          this.member,
          this.data.subscriptionId,
          paymentForm
        );
      } else {
        await this.cancelContribution(true);
      }
    }

    if (!this.data.subscriptionId) {
      this.data.subscriptionId = await createSubscription(
        this.data.mandateId,
        paymentForm,
        calcRenewalDate(this.member)
      );
    }

    const startNow = await prorateSubscription(
      this.member,
      this.data.mandateId,
      paymentForm
    );

    /*
    let startNow;
    
    if (this.member.membership?.isActive) {
      if (this.data.subscriptionId) {
        // Only update if there is a change
        if (
          paymentForm.monthlyAmount !== this.member.contributionMonthlyAmount ||
          paymentForm.payFee !== this.data.payFee
        ) {
          await updateSubscription(
            this.member,
            this.data.subscriptionId,
            paymentForm
          );
        }
      } else {
        this.data.subscriptionId = await createSubscription(
          this.data.mandateId,
          paymentForm,
          calcRenewalDate(this.member)
        );
      }

      startNow = await prorateSubscription(
        this.member,
        this.data.mandateId,
        paymentForm
      );
    } else {
      if (this.data.subscriptionId) {
        await this.cancelContribution(true);
      }

      this.data.subscriptionId = await createSubscription(
        this.data.mandateId,
        paymentForm
      );
      startNow = true;
    }*/

    const expiryDate = await getNextChargeDate(this.data.subscriptionId);

    log.info("Activate contribution for " + this.member.id, {
      userId: this.member.id,
      paymentForm,
      startNow,
      expiryDate
    });

    this.data.payFee = paymentForm.payFee;
    await this.updateData();

    return { startNow, expiryDate };
  }

  async cancelContribution(keepMandate: boolean): Promise<void> {
    log.info("Cancel subscription for " + this.member.id, { keepMandate });

    const subscriptionId = this.data.subscriptionId;
    const mandateId = this.data.mandateId;

    // Do this before cancellation to avoid webhook race conditions
    this.data.subscriptionId = null;
    this.data.cancelledAt = new Date();
    if (!keepMandate) {
      this.data.mandateId = null;
    }
    await this.updateData();

    if (mandateId && !keepMandate) {
      await gocardless.mandates.cancel(mandateId);
    }
    if (subscriptionId) {
      await gocardless.subscriptions.cancel(subscriptionId);
    }
  }

  async updatePaymentSource(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    log.info("Update payment source for " + this.member.id, {
      userId: this.member.id,
      data: this.data,
      completedPaymentFlow
    });

    const hadSubscription = !!this.data.subscriptionId;

    this.data.subscriptionId = null;

    if (this.data.mandateId) {
      // Remove subscription before cancelling mandate to stop the webhook triggering a cancelled email
      await this.updateData();
      // TODO: removed the removing?!
    }

    this.data.customerId = completedPaymentFlow.customerId;
    this.data.mandateId = completedPaymentFlow.mandateId;

    await this.updateData();

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

  async hasPendingPayment(): Promise<boolean> {
    for (const status of GCPayment.pendingStatuses) {
      const payments = await gocardless.payments.list({
        limit: 1,
        status,
        mandate: this.data.mandateId
      });
      if (payments.length > 0) {
        return true;
      }
    }

    return false;
  }

  async getPayments(): Promise<Payment[]> {
    return await getRepository(GCPayment).find({
      where: { member: this.member.id },
      order: { chargeDate: "DESC" }
    });
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
    await getRepository(GCPayment).delete({ member: this.member });
    if (this.data.mandateId) {
      await gocardless.mandates.cancel(this.data.mandateId);
    }
    if (this.data.customerId) {
      await gocardless.customers.remove(this.data.customerId);
    }
  }
}

import format from "date-fns/format";
import moment from "moment";
import {
  PaymentCurrency,
  SubscriptionIntervalUnit
} from "gocardless-nodejs/types/Types";
import { getRepository } from "typeorm";

import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import {
  ContributionPeriod,
  ContributionType,
  getActualAmount,
  PaymentForm,
  PaymentSource
} from "@core/utils";
import { calcMonthsLeft, calcRenewalDate } from "@core/utils/payment";

import {
  CompletedPaymentFlow,
  PaymentProvider,
  PaymentFlow,
  PaymentFlowParams,
  UpdateContributionData
} from "@core/providers/payment";

import config from "@config";

import Address from "@models/Address";
import GCPayment from "@models/GCPayment";
import GCPaymentData from "@models/GCPaymentData";
import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";
import Payment from "@models/Payment";

import NoPaymentSource from "@api/errors/NoPaymentSource";

interface PayingMember extends Member {
  contributionMonthlyAmount: number;
  contributionPeriod: ContributionPeriod;
}

interface GCContributionInfo {
  cancellationDate?: Date;
  paymentSource?: PaymentSource;
  payFee: boolean;
  hasPendingPayment: boolean;
}

const log = mainLogger.child({ app: "gc-payment-service" });

// Update contribution has been split into lots of methods as it's complicated
// and has mutable state, nothing else should use the private methods in here
abstract class UpdateContributionPaymentService {
  abstract getPaymentData(member: Member): Promise<GCPaymentData | undefined>;

  abstract cancelContribution(
    member: Member,
    keepMandate: boolean
  ): Promise<void>;

  async updateContribution(
    user: Member,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionData> {
    log.info("Update contribution for " + user.id, {
      userId: user.id,
      paymentForm
    });

    let gcData = await this.getPaymentData(user);

    if (!gcData?.mandateId) {
      throw new NoPaymentSource();
    }

    let startNow;

    if (user.membership?.isActive) {
      gcData = gcData.subscriptionId
        ? await this.updateSubscription(
            user as PayingMember,
            gcData,
            paymentForm
          )
        : await this.createSubscription(
            user,
            gcData,
            paymentForm,
            calcRenewalDate(user)
          );

      startNow = await this.prorateSubscription(
        user as PayingMember,
        gcData,
        paymentForm
      );
    } else {
      if (gcData.subscriptionId) {
        await this.cancelContribution(user, true);
        gcData.subscriptionId = null;
      }

      gcData = await this.createSubscription(user, gcData, paymentForm);
      startNow = true;
    }

    const expiryDate = await this.activateContribution(
      user,
      gcData,
      paymentForm,
      startNow
    );
    return { startNow, expiryDate };
  }

  private getChargeableAmount(
    amount: number,
    period: ContributionPeriod,
    payFee: boolean
  ): number {
    const actualAmount = getActualAmount(amount, period);
    const chargeableAmount = payFee
      ? Math.floor((actualAmount / 0.99) * 100) + 20
      : actualAmount * 100;
    return Math.round(chargeableAmount); // TODO: fix this properly
  }

  private async createSubscription(
    member: Member,
    gcData: GCPaymentData,
    paymentForm: PaymentForm,
    _startDate?: Date
  ): Promise<GCPaymentData> {
    let startDate = _startDate && format(_startDate, "yyyy-MM-dd");

    log.info("Create subscription for " + member.id, {
      paymentForm,
      startDate
    });

    if (startDate) {
      const mandate = await gocardless.mandates.get(gcData.mandateId!);
      // next_possible_charge_date will always have a value as this is an active mandate
      if (startDate < mandate.next_possible_charge_date!) {
        startDate = mandate.next_possible_charge_date;
      }
    }

    const subscription = await gocardless.subscriptions.create({
      amount: this.getChargeableAmount(
        paymentForm.monthlyAmount,
        paymentForm.period,
        paymentForm.payFee
      ).toString(),
      currency: config.currencyCode.toUpperCase(),
      interval_unit:
        paymentForm.period === ContributionPeriod.Annually
          ? SubscriptionIntervalUnit.Yearly
          : SubscriptionIntervalUnit.Monthly,
      name: "Membership",
      links: {
        mandate: gcData.mandateId!
      },
      ...(startDate && { start_date: startDate })
    });

    gcData.subscriptionId = subscription.id;
    gcData.payFee = paymentForm.payFee;
    return gcData;
  }

  private async updateSubscription(
    user: PayingMember,
    gcData: GCPaymentData,
    paymentForm: PaymentForm
  ): Promise<GCPaymentData> {
    // Don't update if the amount isn't actually changing
    if (
      paymentForm.monthlyAmount === user.contributionMonthlyAmount &&
      paymentForm.payFee === gcData.payFee
    ) {
      return gcData;
    }

    const chargeableAmount = this.getChargeableAmount(
      paymentForm.monthlyAmount,
      user.contributionPeriod,
      paymentForm.payFee
    );

    log.info(
      `Update subscription amount for ${user.id} to ${chargeableAmount}`
    );

    try {
      await gocardless.subscriptions.update(gcData.subscriptionId!, {
        amount: chargeableAmount.toString(),
        name: "Membership" // Slowly overwrite subscription names
      });
    } catch (gcError: any) {
      // Can't update subscription names if they are linked to a plan
      if (gcError.response && gcError.response.status === 422) {
        await gocardless.subscriptions.update(gcData.subscriptionId!, {
          amount: chargeableAmount.toString()
        });
      } else {
        throw gcError;
      }
    }

    gcData.payFee = paymentForm.payFee;
    return gcData;
  }

  private async prorateSubscription(
    member: PayingMember,
    gcData: GCPaymentData,
    paymentForm: PaymentForm
  ): Promise<boolean> {
    const monthsLeft = calcMonthsLeft(member);
    const prorateAmount =
      (paymentForm.monthlyAmount - member.contributionMonthlyAmount) *
      monthsLeft;

    log.info("Prorate subscription for " + member.id, {
      userId: member.id,
      paymentForm,
      monthsLeft,
      prorateAmount
    });

    if (prorateAmount >= 0) {
      // Amounts of less than 1 can't be charged, just ignore them
      if (prorateAmount < 1) {
        return true;
      } else if (paymentForm.prorate) {
        await gocardless.payments.create({
          amount: (prorateAmount * 100).toFixed(0),
          currency: config.currencyCode.toUpperCase() as PaymentCurrency,
          // TODO: i18n description: "One-off payment to start new contribution",
          links: {
            mandate: gcData.mandateId!
          }
        });
        return true;
      }
    }

    return false;
  }

  private async activateContribution(
    member: Member,
    gcData: GCPaymentData,
    paymentForm: PaymentForm,
    startNow: boolean
  ): Promise<Date> {
    const subscription = await gocardless.subscriptions.get(
      gcData.subscriptionId!
    );
    const futurePayments = await gocardless.payments.list({
      subscription: subscription.id,
      "charge_date[gte]": moment.utc().format("YYYY-MM-DD")
    });
    const nextChargeDate = moment
      .utc(
        futurePayments.length > 0
          ? futurePayments.map((p) => p.charge_date).sort()[0]
          : subscription.upcoming_payments[0].charge_date
      )
      .add(config.gracePeriod);

    log.info("Activate contribution for " + member.id, {
      userId: member.id,
      paymentForm,
      startNow,
      nextChargeDate
    });

    gcData.cancelledAt = null;
    await getRepository(GCPaymentData).update(gcData.member.id, gcData);
    return nextChargeDate.toDate();
  }
}

class GCPaymentService
  extends UpdateContributionPaymentService
  implements PaymentProvider
{
  async customerToMember(customerId: string): Promise<{
    partialMember: Partial<Member>;
    billingAddress: Address;
  }> {
    const customer = await gocardless.customers.get(customerId);

    return {
      partialMember: {
        firstname: customer.given_name || "",
        lastname: customer.family_name || "",
        contributionType: ContributionType.GoCardless
      },
      billingAddress: {
        line1: customer.address_line1 || "",
        line2: customer.address_line2,
        city: customer.city || "",
        postcode: customer.postal_code || ""
      }
    };
  }

  async getContributionInfo(
    member: Member
  ): Promise<GCContributionInfo | undefined> {
    const gcData = await this.getPaymentData(member);

    if (gcData) {
      let bankAccount;
      if (gcData.mandateId) {
        try {
          const mandate = await gocardless.mandates.get(gcData.mandateId);
          bankAccount = await gocardless.customerBankAccounts.get(
            mandate.links.customer_bank_account
          );
        } catch (err: any) {
          // 404s can happen on dev as we don't use real mandate IDs
          if (!(config.dev && err.response && err.response.status === 404)) {
            throw err;
          }
        }
      }

      return {
        ...(gcData.cancelledAt && { cancellationDate: gcData.cancelledAt }),
        ...(bankAccount && {
          paymentSource: {
            type: "direct-debit" as const,
            bankName: bankAccount.bank_name,
            accountHolderName: bankAccount.account_holder_name,
            accountNumberEnding: bankAccount.account_number_ending
          }
        }),
        payFee: gcData.payFee || false,
        hasPendingPayment: await this.hasPendingPayment(member)
      };
    }
  }

  async getPaymentData(member: Member): Promise<GCPaymentData | undefined> {
    const paymentData = await getRepository(GCPaymentData).findOne({ member });
    // TODO: is this necessary?
    if (paymentData) {
      paymentData.member = member;
    }
    return paymentData;
  }

  async canChangeContribution(
    user: Member,
    useExistingMandate: boolean
  ): Promise<boolean> {
    const gcData = await this.getPaymentData(user);
    // No payment method available
    if (useExistingMandate && !gcData?.mandateId) {
      return false;
    }

    // Can always change contribution if there is no subscription
    if (!gcData?.subscriptionId) {
      return true;
    }

    // Monthly contributors can update their contribution even if they have
    // pending payments, but they can't always change their mandate as this can
    // result in double charging
    return (
      (useExistingMandate && user.contributionPeriod === "monthly") ||
      !(await this.hasPendingPayment(user))
    );
  }

  async cancelContribution(member: Member, keepMandate = false): Promise<void> {
    log.info("Cancel subscription for " + member.id, { keepMandate });

    const gcData = await this.getPaymentData(member);
    if (gcData) {
      // Do this before cancellation to avoid webhook race conditions
      await getRepository(GCPaymentData).update(gcData.member.id, {
        subscriptionId: null,
        ...(!keepMandate && { mandateId: null }),
        cancelledAt: new Date()
      });

      if (gcData.mandateId && !keepMandate) {
        await gocardless.mandates.cancel(gcData.mandateId);
      }
      if (gcData.subscriptionId) {
        await gocardless.subscriptions.cancel(gcData.subscriptionId);
      }
    }
  }

  async updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void> {
    const gcData = (await this.getPaymentData(member)) || new GCPaymentData();

    log.info("Update payment source for " + member.id, {
      userId: member.id,
      gcData,
      customerId,
      mandateId
    });

    const hadSubscription = !!gcData.subscriptionId;

    if (gcData.mandateId) {
      // Remove subscription before cancelling mandate to stop the webhook triggering a cancelled email
      await getRepository(GCPaymentData).update(gcData.member.id, {
        subscriptionId: null
      });
      await gocardless.mandates.cancel(gcData.mandateId);
    }

    // This could be creating payment data for the first time
    gcData.member = member;
    gcData.customerId = customerId;
    gcData.mandateId = mandateId;
    gcData.subscriptionId = null;

    await getRepository(GCPaymentData).save(gcData);

    if (hadSubscription) {
      await this.updateContribution(member, {
        monthlyAmount: member.contributionMonthlyAmount!,
        period: member.contributionPeriod!,
        payFee: !!gcData.payFee,
        prorate: false
      });
    }
  }

  async hasPendingPayment(member: Member): Promise<boolean> {
    const gcData = await this.getPaymentData(member);
    if (gcData && gcData.subscriptionId) {
      for (const status of GCPayment.pendingStatuses) {
        const payments = await gocardless.payments.list({
          limit: 1,
          status,
          subscription: gcData.subscriptionId
        });
        if (payments.length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  async getPayments(member: Member): Promise<Payment[]> {
    return await getRepository(GCPayment).find({
      where: { member: member.id },
      order: { chargeDate: "DESC" }
    });
  }

  async permanentlyDeleteMember(member: Member): Promise<void> {
    const gcData = await this.getPaymentData(member);
    await getRepository(GCPayment).delete({ member });
    if (gcData?.mandateId) {
      await gocardless.mandates.cancel(gcData.mandateId);
    }
    if (gcData?.customerId) {
      await gocardless.customers.remove(gcData.customerId);
    }
  }

  async createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    params: PaymentFlowParams
  ): Promise<PaymentFlow> {
    const redirectFlow = await gocardless.redirectFlows.create({
      session_token: joinFlow.id,
      success_redirect_url: completeUrl,
      prefilled_customer: {
        email: params.email,
        ...(params.firstname && { given_name: params.firstname }),
        ...(params.lastname && { family_name: params.lastname })
      }
    });

    return {
      id: redirectFlow.id,
      url: redirectFlow.redirect_url
    };
  }

  async completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    const redirectFlow = await gocardless.redirectFlows.complete(
      joinFlow.paymentFlowId,
      {
        session_token: joinFlow.id
      }
    );
    return {
      customerId: redirectFlow.links.customer,
      mandateId: redirectFlow.links.mandate
    };
  }
}

export default new GCPaymentService();

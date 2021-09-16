import moment from "moment";
import {
  CustomerBankAccount,
  PaymentCurrency,
  RedirectFlow,
  SubscriptionIntervalUnit
} from "gocardless-nodejs/types/Types";
import { getRepository } from "typeorm";

import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import {
  cleanEmailAddress,
  ContributionPeriod,
  ContributionType,
  getActualAmount,
  PaymentForm
} from "@core/utils";

import { CompletedJoinFlow } from "@core/services/JoinFlowService";
import MembersService, {
  PartialMember,
  PartialMemberProfile
} from "@core/services/MembersService";

import config from "@config";

import GCPayment from "@models/GCPayment";
import GCPaymentData from "@models/GCPaymentData";
import Member from "@models/Member";
import Payment from "@models/Payment";

export interface RedirectFlowParams {
  email: string;
  firstname?: string;
  lastname?: string;
}

interface PayingMember extends Member {
  contributionMonthlyAmount: number;
  contributionPeriod: ContributionPeriod;
}

const log = mainLogger.child({ app: "gc-payment-service" });

// Update contribution has been split into lots of methods as it's complicated
// and has mutable state, nothing else should use the private methods in here
abstract class UpdateContributionPaymentService {
  async updateContribution(
    user: Member,
    paymentForm: PaymentForm
  ): Promise<void> {
    log.info("Update contribution for " + user.id, {
      userId: user.id,
      paymentForm
    });

    let gcData = await GCPaymentService.getPaymentData(user);

    if (!gcData?.mandateId) {
      throw new Error("User does not have active payment method");
    }

    let startNow = true;

    if (user.isActiveMember) {
      if (gcData.subscriptionId) {
        gcData = await this.updateSubscription(
          user as PayingMember,
          gcData,
          paymentForm
        );
      } else {
        const membershipExpiryDate = user.permissions.find(
          (p) => p.permission === "member"
        )!.dateExpires;
        const startDate = moment
          .utc(membershipExpiryDate)
          .subtract(config.gracePeriod);
        gcData = await this.createSubscription(
          user,
          gcData,
          paymentForm,
          startDate.format("YYYY-MM-DD")
        );
      }

      startNow = await this.prorateSubscription(
        user as PayingMember,
        gcData,
        paymentForm
      );
    } else {
      if (gcData.subscriptionId) {
        await GCPaymentService.cancelContribution(user, true);
        gcData.subscriptionId = undefined;
      }

      gcData = await this.createSubscription(user, gcData, paymentForm);
    }

    await this.activateContribution(user, gcData, paymentForm, startNow);
  }

  private getChargeableAmount(
    amount: number,
    period: ContributionPeriod,
    payFee: boolean
  ): number {
    const actualAmount = getActualAmount(amount, period);
    return payFee
      ? Math.floor((actualAmount / 0.99) * 100) + 20
      : actualAmount * 100;
  }

  private async createSubscription(
    member: Member,
    gcData: GCPaymentData,
    paymentForm: PaymentForm,
    startDate?: string
  ): Promise<GCPaymentData> {
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
        mandate: gcData.mandateId
      },
      ...(startDate && { start_date: startDate })
    });

    await MembersService.updateMember(member, {
      contributionPeriod: paymentForm.period
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
    } catch (gcError) {
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
    const monthsLeft = member.memberMonthsRemaining;
    const prorateAmount =
      (paymentForm.monthlyAmount - member.contributionMonthlyAmount) *
      monthsLeft;

    log.info("Prorate subscription for " + member.id, {
      userId: member.id,
      paymentForm,
      monthsLeft,
      prorateAmount
    });

    if (prorateAmount > 0 && paymentForm.prorate) {
      await gocardless.payments.create({
        amount: (prorateAmount * 100).toFixed(0),
        currency: config.currencyCode.toUpperCase() as PaymentCurrency,
        description: "One-off payment to start new contribution",
        links: {
          mandate: gcData.mandateId
        }
      });
    }

    return prorateAmount === 0 || paymentForm.prorate;
  }

  private async activateContribution(
    member: Member,
    gcData: GCPaymentData,
    paymentForm: PaymentForm,
    startNow: boolean
  ): Promise<void> {
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

    await MembersService.updateMember(member, {
      contributionType: ContributionType.GoCardless,
      ...(startNow
        ? {
            contributionMonthlyAmount: paymentForm.monthlyAmount,
            nextContributionMonthlyAmount: undefined
          }
        : {
            nextContributionMonthlyAmount: paymentForm.monthlyAmount
          })
    });

    await MembersService.extendMemberPermission(
      member,
      "member",
      nextChargeDate.toDate()
    );

    gcData.cancelledAt = undefined;
    await getRepository(GCPaymentData).update(gcData.member.id, gcData);
  }
}

export default class GCPaymentService extends UpdateContributionPaymentService {
  async customerToMember(joinFlow: CompletedJoinFlow): Promise<{
    partialMember: PartialMember;
    partialProfile: PartialMemberProfile;
  }> {
    const customer = await gocardless.customers.get(joinFlow.customerId);

    return {
      partialMember: {
        firstname: customer.given_name || "",
        lastname: customer.family_name || "",
        email: joinFlow.joinForm.email,
        contributionType: ContributionType.GoCardless
      },
      partialProfile: {
        deliveryOptIn: false,
        deliveryAddress: {
          line1: customer.address_line1 || "",
          line2: customer.address_line2,
          city: customer.city || "",
          postcode: customer.postal_code || ""
        }
      }
    };
  }

  async getBankAccount(member: Member): Promise<CustomerBankAccount | null> {
    const gcData = await this.getPaymentData(member);
    if (gcData?.mandateId) {
      try {
        const mandate = await gocardless.mandates.get(gcData.mandateId);
        return await gocardless.customerBankAccounts.get(
          mandate.links.customer_bank_account
        );
      } catch (err) {
        // 404s can happen on dev as we don't use real mandate IDs
        if (config.dev && err.response && err.response.status === 404) {
          return null;
        }
        throw err;
      }
    } else {
      return null;
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

    const gcData = await GCPaymentService.getPaymentData(member);
    if (gcData) {
      // Do this before cancellation to avoid webhook race conditions
      await getRepository(GCPaymentData).update(gcData.member.id, {
        subscriptionId: undefined,
        ...(!keepMandate && { mandateId: undefined }),
        cancelledAt: new Date()
      });

      if (gcData.mandateId && !keepMandate) {
        await gocardless.mandates.cancel(gcData.mandateId);
      }
      if (gcData.subscriptionId) {
        await gocardless.subscriptions.cancel(gcData.subscriptionId);
      }

      await MembersService.updateMember(member, {
        nextContributionMonthlyAmount: undefined
      });
    }
  }

  async updatePaymentMethod(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void> {
    const gcData =
      (await GCPaymentService.getPaymentData(member)) || new GCPaymentData();

    log.info("Update payment method for " + member.id, {
      userId: member.id,
      gcData,
      customerId,
      mandateId
    });

    if (gcData.mandateId) {
      // Remove subscription before cancelling mandate to stop the webhook triggering a cancelled email
      await getRepository(GCPaymentData).update(gcData.member.id, {
        subscriptionId: undefined
      });
      await gocardless.mandates.cancel(gcData.mandateId);
    }

    // This could be creating payment data for the first time
    gcData.member = member;
    gcData.customerId = customerId;
    gcData.mandateId = mandateId;
    gcData.subscriptionId = undefined;

    await getRepository(GCPaymentData).save(gcData);
  }

  async hasPendingPayment(member: Member): Promise<boolean> {
    const gcData = await GCPaymentService.getPaymentData(member);
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
    const gcData = await GCPaymentService.getPaymentData(member);
    await getRepository(GCPayment).delete({ member });
    if (gcData?.mandateId) {
      await gocardless.mandates.cancel(gcData.mandateId);
    }
    if (gcData?.customerId) {
      await gocardless.customers.remove(gcData.customerId);
    }
  }

  async createRedirectFlow(
    sessionToken: string,
    completeUrl: string,
    paymentForm: PaymentForm,
    params: RedirectFlowParams
  ): Promise<{ id: string; url: string }> {
    const actualAmount = getActualAmount(
      paymentForm.monthlyAmount,
      paymentForm.period
    );

    const redirectFlow = await gocardless.redirectFlows.create({
      description: `Membership: ${config.currencySymbol}${actualAmount}/${
        paymentForm.period
      }${paymentForm.payFee ? " (+ fee)" : ""}`,
      session_token: sessionToken,
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

  async completeRedirectFlow(
    redirectFlowId: string,
    sessionToken: string
  ): Promise<RedirectFlow> {
    return await gocardless.redirectFlows.complete(redirectFlowId, {
      session_token: sessionToken
    });
  }
}

export default new GCPaymentService();

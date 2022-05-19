import Stripe from "stripe";
import stripe from "@core/lib/stripe";
import { ContributionPeriod, getActualAmount, PaymentForm } from "@core/utils";
import Member from "@models/Member";
import config from "@config";

function getChargeableAmount(
  amount: number,
  period: ContributionPeriod,
  payFee: boolean
): number {
  const actualAmount = getActualAmount(amount, period);
  const chargeableAmount = payFee ? actualAmount * 100 : actualAmount * 100;
  return Math.round(chargeableAmount);
}

export async function createSubscription(
  customerId: string,
  paymentForm: PaymentForm,
  startDate?: Date
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [
      {
        price_data: {
          currency: config.currencyCode,
          product: config.stripe.membershipProductId,
          recurring: {
            interval:
              paymentForm.period === ContributionPeriod.Monthly
                ? "month"
                : "year"
          },
          unit_amount: getChargeableAmount(
            paymentForm.monthlyAmount,
            paymentForm.period,
            paymentForm.payFee
          )
        }
      }
    ],
    off_session: true
  });

  // TODO: start date

  return subscription;
}

export async function updateSubscription(
  member: Member,
  subscriptionId: string,
  paymentForm: PaymentForm
): Promise<Stripe.Subscription> {
  const chargeableAmount = getChargeableAmount(
    paymentForm.monthlyAmount,
    member.contributionPeriod!,
    paymentForm.payFee
  );

  // TODO: update
  return await stripe.subscriptions.update(subscriptionId, {
    items: []
  });
}

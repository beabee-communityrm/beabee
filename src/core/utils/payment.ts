import config from "@config";
import Member from "@models/Member";
import {
  addMonths,
  getYear,
  isBefore,
  setYear,
  sub,
  differenceInMonths,
  add
} from "date-fns";
import { ContributionPeriod, ContributionType, PaymentMethod } from ".";

export function calcRenewalDate(user: Member): Date | undefined {
  if (user.membership?.isActive) {
    const now = new Date();

    if (user.membership.dateExpires) {
      const maxDate = add(now, {
        months: user.contributionPeriod === ContributionPeriod.Annually ? 12 : 1
      });
      const targetDate = sub(user.membership.dateExpires, config.gracePeriod);

      // Ensure date is no more than 1 period away from now, this could happen if
      // manual contributors had their expiry date set arbritarily in the future
      return maxDate < targetDate ? maxDate : targetDate;

      // Some special rules for upgrading non-expiring manual contributions
    } else if (user.contributionType === ContributionType.Manual) {
      // Annual contribution, calculate based on their start date
      if (user.contributionPeriod === ContributionPeriod.Annually) {
        const thisYear = getYear(now);
        const startDate = setYear(user.membership.dateAdded, thisYear);
        if (isBefore(startDate, now)) {
          return setYear(startDate, thisYear + 1);
        }
        return startDate;
      } else {
        // Monthly contribution, give them a 1 month grace period
        return addMonths(now, 1);
      }
    }
  }
}

export function calcMonthsLeft(user: Member): number {
  const renewalDate = calcRenewalDate(user);
  return renewalDate
    ? Math.max(0, differenceInMonths(renewalDate, new Date()))
    : 0;
}

interface Feeable {
  amount: number;
  period: ContributionPeriod;
  paymentMethod: PaymentMethod;
}

const fees: Record<
  typeof config.stripe.country,
  Record<PaymentMethod, (a: number) => number>
> = {
  gb: {
    [PaymentMethod.StripeCard]: (amount) => 0.2 + 0.014 * amount,
    [PaymentMethod.StripeSEPA]: () => 0.3,
    [PaymentMethod.GoCardlessDirectDebit]: (amount) => 0.2 + amount / 100
  },
  eu: {
    [PaymentMethod.StripeCard]: (amount) => 0.25 + 0.014 * amount,
    [PaymentMethod.StripeSEPA]: () => 0.35,
    [PaymentMethod.GoCardlessDirectDebit]: (amount) => 0.2 + amount / 100
  }
} as const;

function calcPaymentFee(feeable: Feeable): number {
  return feeable.period === ContributionPeriod.Annually
    ? 0
    : fees[config.stripe.country][feeable.paymentMethod](feeable.amount);
}

export default calcPaymentFee;

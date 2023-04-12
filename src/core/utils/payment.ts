import {
  ContributionPeriod,
  ContributionType,
  PaymentMethod,
  calcPaymentFee
} from "@beabee/beabee-common";
import config from "@config";
import Contact from "@models/Contact";
import {
  addMonths,
  getYear,
  isBefore,
  setYear,
  sub,
  differenceInMonths,
  add
} from "date-fns";
import { getActualAmount, PaymentForm } from ".";

export function calcRenewalDate(contact: Contact): Date | undefined {
  if (contact.membership?.isActive) {
    const now = new Date();

    if (contact.membership.dateExpires) {
      const maxDate = add(now, {
        months:
          contact.contributionPeriod === ContributionPeriod.Annually ? 12 : 1
      });
      const targetDate = sub(
        contact.membership.dateExpires,
        config.gracePeriod
      );

      // Ensure date is no more than 1 period away from now, this could happen if
      // manual contributors had their expiry date set arbritarily in the future
      return maxDate < targetDate ? maxDate : targetDate;

      // Some special rules for upgrading non-expiring manual contributions
    } else if (contact.contributionType === ContributionType.Manual) {
      // Annual contribution, calculate based on their start date
      if (contact.contributionPeriod === ContributionPeriod.Annually) {
        const thisYear = getYear(now);
        const startDate = setYear(contact.membership.dateAdded, thisYear);
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

export function calcMonthsLeft(contact: Contact): number {
  const renewalDate = calcRenewalDate(contact);
  return renewalDate
    ? Math.max(0, differenceInMonths(renewalDate, new Date()))
    : 0;
}

export function getChargeableAmount(
  paymentForm: PaymentForm,
  paymentMethod: PaymentMethod
): number {
  const amount = getActualAmount(paymentForm.monthlyAmount, paymentForm.period);
  const fee = paymentForm.payFee
    ? calcPaymentFee(
        { amount, period: paymentForm.period, paymentMethod },
        config.stripe.country
      )
    : 0;
  return Math.round((amount + fee) * 100);
}

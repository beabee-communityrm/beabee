import config from "@config";
import Member from "@models/Member";
import {
  addMonths,
  getYear,
  isBefore,
  setYear,
  sub,
  differenceInMonths
} from "date-fns";
import { ContributionPeriod, ContributionType } from ".";

export function calcRenewalDate(user: Member): Date {
  const now = new Date();
  if (user.membership?.isActive) {
    // Has an expiry date, just use that minus the grace period
    if (user.membership.dateExpires) {
      return sub(user.membership.dateExpires, config.gracePeriod);
    }

    // Some special rules for upgrading non-expiring manual contributions
    if (user.contributionType === ContributionType.Manual) {
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

  return now;
}

export function calcMonthsLeft(user: Member): number {
  return Math.max(0, differenceInMonths(calcRenewalDate(user), new Date()));
}

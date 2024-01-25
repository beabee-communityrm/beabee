import { ContributionPeriod } from "@beabee/beabee-common";
import {
  ValidateBy,
  ValidationOptions,
  buildMessage,
  isEnum
} from "class-validator";

import OptionsService from "@core/services/OptionsService";
import { isNumber } from "lodash";

export function isValidPayFee(
  value: unknown,
  amount: unknown,
  period: unknown
): boolean {
  if (
    typeof value !== "boolean" ||
    !isEnum(period, ContributionPeriod) ||
    !isNumber(amount)
  ) {
    return false;
  }

  // Annual contributions don't pay a fee
  if (value && period === ContributionPeriod.Annually) {
    return false;
  }
  // £1 monthly contributions must pay fee
  if (!value && period === ContributionPeriod.Monthly && amount === 1) {
    return false;
  }

  return true;
}

export default function IsValidPayFee(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy({
    name: "isValidPayFee",
    validator: {
      validate: (value, args) => {
        if (!args) return false;

        // Show always be false if the option is disabled
        if (!OptionsService.getBool("show-absorb-fee")) return value === false;

        const amount = "amount" in args.object && args.object.amount;
        const period = "period" in args.object && args.object.period;

        return isValidPayFee(value, amount, period as ContributionPeriod);
      },
      defaultMessage: buildMessage(
        (eachPrefix) => eachPrefix + `$property is not valid`,
        validationOptions
      )
    }
  });
}

import { ContributionPeriod } from "@beabee/beabee-common";
import {
  ValidateBy,
  ValidationArguments,
  ValidationOptions,
  buildMessage
} from "class-validator";

import OptionsService from "@core/services/OptionsService";

function isValidPayFee(value: unknown, args?: ValidationArguments): boolean {
  if (typeof value !== "boolean" || !args) return false;

  // Show always be false if the option is disabled
  if (!OptionsService.getBool("show-absorb-fee")) return value === false;

  const amount = "amount" in args.object && args.object.amount;
  const period = "period" in args.object && args.object.period;
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
      validate: isValidPayFee,
      defaultMessage: buildMessage(
        (eachPrefix) => eachPrefix + `$property is not valid`,
        validationOptions
      )
    }
  });
}

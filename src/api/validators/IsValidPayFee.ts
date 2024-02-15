import { ContributionPeriod, isValidPayFee } from "@beabee/beabee-common";
import { ValidateBy, ValidationOptions, buildMessage } from "class-validator";

import OptionsService from "@core/services/OptionsService";

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

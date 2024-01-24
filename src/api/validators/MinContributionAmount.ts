import { ContributionPeriod } from "@beabee/beabee-common";
import {
  buildMessage,
  ValidateBy,
  ValidationArguments,
  ValidationOptions
} from "class-validator";

import OptionsService from "@core/services/OptionsService";

function getMinAmount(args: ValidationArguments | undefined): number | false {
  const minMonthlyAmount = OptionsService.getInt(
    "contribution-min-monthly-amount"
  );

  const period = args && "period" in args.object && args.object.period;
  return period === ContributionPeriod.Monthly
    ? minMonthlyAmount
    : period === ContributionPeriod.Annually
      ? minMonthlyAmount * 12
      : false;
}

export default function MinContributionAmount(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "minContributionAmount",
      validator: {
        validate: (value, args) => {
          const minAmount = getMinAmount(args);
          return (
            minAmount !== false &&
            typeof value === "number" &&
            value > minAmount
          );
        },
        defaultMessage: buildMessage((eachPrefix, args) => {
          const minAmount = !!args && getMinAmount(args);
          return minAmount === false
            ? eachPrefix + `must have a valid period`
            : eachPrefix + `$property must be at least ${minAmount}`;
        }, validationOptions)
      }
    },
    validationOptions
  );
}

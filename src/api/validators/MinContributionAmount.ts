import { ContributionPeriod } from "@beabee/beabee-common";
import {
  buildMessage,
  isEnum,
  isNumber,
  ValidateBy,
  ValidationArguments,
  ValidationOptions
} from "class-validator";

import OptionsService from "@core/services/OptionsService";

function getMinAmount(period: ContributionPeriod) {
  const minMonthlyAmount = OptionsService.getInt(
    "contribution-min-monthly-amount"
  );

  return period === ContributionPeriod.Monthly
    ? minMonthlyAmount
    : minMonthlyAmount * 12;
}

function isPeriod(period: unknown): period is ContributionPeriod {
  return isEnum(period, ContributionPeriod);
}

function getPeriod(
  args: ValidationArguments | undefined
): ContributionPeriod | undefined {
  return args &&
    "period" in args.object &&
    args.object.period &&
    isPeriod(args.object.period)
    ? args.object.period
    : undefined;
}

export function minContributionAmount(
  value: unknown,
  period: unknown,
  minMonthlyAmount: number
): boolean {
  if (!isNumber(value) || !isPeriod(period)) return false;

  return period === ContributionPeriod.Monthly
    ? value >= minMonthlyAmount
    : value >= minMonthlyAmount * 12;
}

export default function MinContributionAmount(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "minContributionAmount",
      validator: {
        validate: (value, args) => {
          const period = getPeriod(args);
          return (
            !!period &&
            minContributionAmount(value, getPeriod(args), getMinAmount(period))
          );
        },
        defaultMessage: buildMessage((eachPrefix, args) => {
          const period = getPeriod(args);
          return period
            ? eachPrefix + `$property must be at least ${getMinAmount(period)}`
            : eachPrefix + `must have a valid period`;
        }, validationOptions)
      }
    },
    validationOptions
  );
}

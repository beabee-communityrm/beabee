import { ContributionPeriod } from "@beabee/beabee-common";
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from "class-validator";

import OptionsService from "#core/services/OptionsService";

@ValidatorConstraint({ name: "minContributionAmount" })
export default class MinContributionAmount
  implements ValidatorConstraintInterface {
  validate(amount: unknown, args: ValidationArguments): boolean {
    return typeof amount === "number" && amount >= this.minAmount(args);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be at least ${this.minAmount(args)}`;
  }

  private minAmount(args: ValidationArguments) {
    const period = (args.object as any)?.period as unknown;
    return (
      OptionsService.getInt("contribution-min-monthly-amount") *
      (period === ContributionPeriod.Annually ? 12 : 1)
    );
  }
}

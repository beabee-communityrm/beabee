import {
  ContributionPeriod,
  ContributionType,
  PaymentMethod
} from "@beabee/beabee-common";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Validate
} from "class-validator";

import IsUrl from "@api/validators/IsUrl";
import MinContributionAmount from "@api/validators/MinContributionAmount";
import ValidPayFee from "@api/validators/ValidPayFee";

import { StartJoinFlowData } from "./JoinFlowData";

export class UpdateContributionData {
  @Validate(MinContributionAmount)
  amount!: number;

  @IsEnum(ContributionPeriod)
  period!: ContributionPeriod;

  @Validate(ValidPayFee)
  payFee!: boolean;

  @IsBoolean()
  prorate!: boolean;

  get monthlyAmount(): number {
    return this.period === ContributionPeriod.Annually
      ? this.amount / 12
      : this.amount;
  }
}

export class StartContributionData
  extends UpdateContributionData
  implements StartJoinFlowData
{
  @IsUrl()
  completeUrl!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}

export class ForceUpdateContributionData {
  @IsIn([ContributionType.Manual, ContributionType.None])
  type!: ContributionType.Manual | ContributionType.None;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsEnum(ContributionPeriod)
  period?: ContributionPeriod;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

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
  IsString
} from "class-validator";

import IsUrl from "@api/validators/IsUrl";
import IsValidPayFee from "@api/validators/IsValidPayFee";
import MinContributionAmount from "@api/validators/MinContributionAmount";

import { StartJoinFlowDto } from "./JoinFlowDto";

export class UpdateContributionDto {
  @MinContributionAmount()
  amount!: number;

  @IsEnum(ContributionPeriod)
  period!: ContributionPeriod;

  @IsValidPayFee()
  payFee!: boolean;

  @IsBoolean()
  prorate!: boolean;

  get monthlyAmount(): number {
    return this.period === ContributionPeriod.Annually
      ? this.amount / 12
      : this.amount;
  }
}

export class StartContributionDto
  extends UpdateContributionDto
  implements StartJoinFlowDto
{
  @IsUrl()
  completeUrl!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}

export class ForceUpdateContributionDto {
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

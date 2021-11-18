import { IsBoolean, IsEnum, IsNumber, Validate } from "class-validator";

import { ContributionPeriod, ContributionType } from "@core/utils";

import IsUrl from "@api/validators/IsUrl";
import MinContributionAmount from "@api/validators/MinContributionAmount";
import ValidPayFee from "@api/validators/ValidPayFee";

import { StartJoinFlowData } from "./JoinFlowData";

export class SetContributionData {
  @Validate(MinContributionAmount)
  amount!: number;

  @IsEnum(ContributionPeriod)
  period!: ContributionPeriod;

  @Validate(ValidPayFee)
  payFee!: boolean;

  get monthlyAmount(): number {
    return this.period === ContributionPeriod.Annually
      ? this.amount / 12
      : this.amount;
  }
}

export class StartContributionData
  extends SetContributionData
  implements StartJoinFlowData
{
  @IsUrl()
  completeUrl!: string;
}

export class UpdateContributionData {
  @IsNumber()
  amount!: number;

  @IsBoolean()
  payFee!: boolean;

  @IsBoolean()
  prorate!: boolean;
}

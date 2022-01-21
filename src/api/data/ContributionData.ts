import { IsBoolean, IsEnum, IsNumber, Validate } from "class-validator";

import { ContributionPeriod } from "@core/utils";

import IsUrl from "@api/validators/IsUrl";
import MinContributionAmount from "@api/validators/MinContributionAmount";
import ValidPayFee from "@api/validators/ValidPayFee";

import { StartJoinFlowData } from "./JoinFlowData";

interface ContributionData {
  amount: number;
  payFee: boolean;
  prorate: boolean;
}

export class SetContributionData implements ContributionData {
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
  extends SetContributionData
  implements StartJoinFlowData
{
  @IsUrl()
  completeUrl!: string;
}

export class UpdateContributionData implements ContributionData {
  @IsNumber()
  amount!: number;

  @IsBoolean()
  payFee!: boolean;

  @IsBoolean()
  prorate!: boolean;
}

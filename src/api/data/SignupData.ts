import IsPassword from "@api/validators/IsPassword";
import IsUrl from "@api/validators/IsUrl";
import { Type } from "class-transformer";
import {
  IsEmail,
  Validate,
  ValidateNested,
  IsOptional,
  IsString,
  IsUUID
} from "class-validator";
import { StartContributionData } from "./ContributionData";
import { CompleteJoinFlowData } from "./JoinFlowData";

export class CompleteUrls {
  @IsUrl()
  loginUrl!: string;

  @IsUrl()
  setPasswordUrl!: string;

  @IsUrl()
  confirmUrl!: string;
}

export class SignupData {
  @IsEmail()
  email!: string;

  @Validate(IsPassword)
  password!: string;

  @Type(() => StartContributionData)
  @ValidateNested()
  @IsOptional()
  contribution?: StartContributionData;

  @Type(() => CompleteUrls)
  @ValidateNested()
  @IsOptional()
  complete?: CompleteUrls;
}

export class SignupCompleteData
  extends CompleteUrls
  implements CompleteJoinFlowData
{
  @IsString()
  paymentFlowId!: string;
}

export class SignupConfirmEmailParam {
  @IsUUID("4")
  joinFlowId!: string;
}

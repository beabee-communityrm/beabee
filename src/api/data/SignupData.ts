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

export class SignupData extends CompleteUrls {
  @IsEmail()
  email!: string;

  @Validate(IsPassword)
  @IsOptional()
  password?: string;

  @Type(() => StartContributionData)
  @ValidateNested()
  @IsOptional()
  contribution?: StartContributionData;
}

export class SignupCompleteData extends CompleteJoinFlowData {
  @IsOptional()
  @IsString()
  firstname?: string;

  @IsOptional()
  @IsString()
  lastname?: string;
}

export class SignupConfirmEmailParam {
  @IsUUID("4")
  joinFlowId!: string;
}

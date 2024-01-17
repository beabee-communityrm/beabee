import IsPassword from "@api/validators/IsPassword";
import IsUrl from "@api/validators/IsUrl";
import { Type } from "class-transformer";
import {
  IsEmail,
  Validate,
  ValidateNested,
  IsOptional,
  IsString
} from "class-validator";
import { StartContributionDto } from "./ContributionDto";
import { CompleteJoinFlowDto } from "./JoinFlowDto";

import { CompleteUrls } from "@type/complete-urls";

export class SignupData implements CompleteUrls {
  @IsUrl()
  loginUrl!: string;

  @IsUrl()
  setPasswordUrl!: string;

  @IsUrl()
  confirmUrl!: string;

  @IsEmail()
  email!: string;

  @Validate(IsPassword)
  @IsOptional()
  password?: string;

  @Type(() => StartContributionDto)
  @ValidateNested()
  @IsOptional()
  contribution?: StartContributionDto;
}

export class SignupCompleteData extends CompleteJoinFlowDto {
  @IsOptional()
  @IsString()
  firstname?: string;

  @IsOptional()
  @IsString()
  lastname?: string;
}

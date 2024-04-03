import { Type } from "class-transformer";
import {
  IsEmail,
  Validate,
  ValidateNested,
  IsOptional,
  IsString
} from "class-validator";

import { UpdateAddressDto } from "@api/dto/AddressDto";
import { StartContributionDto } from "@api/dto/ContributionDto";
import { CompleteJoinFlowDto } from "@api/dto/JoinFlowDto";
import IsPassword from "@api/validators/IsPassword";
import IsUrl from "@api/validators/IsUrl";

import type JoinForm from "@models/JoinForm";

import { CompleteUrls } from "@type/complete-urls";

export class StartSignupFlowDto implements CompleteUrls {
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

export class CompleteSignupFlowDto
  extends CompleteJoinFlowDto
  implements Pick<JoinForm, "firstname" | "lastname" | "vatNumber">
{
  @IsOptional()
  @IsString()
  firstname?: string;

  @IsOptional()
  @IsString()
  lastname?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;
}

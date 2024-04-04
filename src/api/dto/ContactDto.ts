import {
  ContributionPeriod,
  ContributionType,
  MembershipStatus,
  NewsletterStatus,
  RoleType,
  RoleTypes,
  PaymentSource
} from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidateNested
} from "class-validator";

import { GetPaginatedQuery } from "@api/dto/BaseDto";
import {
  GetContactProfileDto,
  UpdateContactProfileDto
} from "@api/dto/ContactProfileDto";
import {
  CreateContactRoleDto,
  GetContactRoleDto
} from "@api/dto/ContactRoleDto";
import { ForceUpdateContributionDto } from "@api/dto/ContributionDto";

import IsPassword from "@api/validators/IsPassword";

import { GetContactWith } from "@enums/get-contact-with";

import { ContributionInfo } from "@type/contribution-info";

const contactSortFields = [
  "firstname",
  "lastname",
  "email",
  "joined",
  "lastSeen",
  "contributionMonthlyAmount",
  "membershipStarts",
  "membershipExpires"
] as const;

export class GetContactOptsDto {
  @IsArray()
  @IsOptional()
  @IsEnum(GetContactWith, { each: true })
  with?: GetContactWith[];
}

export class ListContactsDto extends GetPaginatedQuery {
  @IsArray()
  @IsOptional()
  @IsEnum(GetContactWith, { each: true })
  with?: GetContactWith[];

  @IsIn(contactSortFields)
  sort?: string;
}

export class GetContributionInfoDto implements ContributionInfo {
  @IsEnum(ContributionType)
  type!: ContributionType;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsNumber()
  nextAmount?: number;

  @IsOptional()
  @IsEnum(ContributionPeriod)
  period?: ContributionPeriod;

  @IsOptional()
  @IsDate()
  cancellationDate?: Date;

  @IsOptional()
  @IsDate()
  renewalDate?: Date;

  @IsOptional()
  @IsObject() // TODO: validate properly
  paymentSource?: PaymentSource;

  @IsOptional()
  @IsBoolean()
  payFee?: boolean;

  @IsOptional()
  @IsBoolean()
  hasPendingPayment?: boolean;

  @IsEnum(MembershipStatus)
  membershipStatus!: MembershipStatus;

  @IsOptional()
  @IsDate()
  membershipExpiryDate?: Date;
}

class BaseContactDto {
  @IsEmail()
  email!: string;

  @IsString()
  firstname!: string;

  @IsString()
  lastname!: string;
}

export class GetContactDto extends BaseContactDto {
  @IsString()
  id!: string;

  @IsDate()
  joined!: Date;

  @IsOptional()
  @IsDate()
  lastSeen?: Date;

  @IsOptional()
  @IsNumber()
  contributionAmount?: number;

  @IsOptional()
  @IsEnum(ContributionPeriod)
  contributionPeriod?: ContributionPeriod;

  @IsArray()
  @IsIn(RoleTypes, { each: true })
  activeRoles!: RoleType[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GetContributionInfoDto)
  contribution?: GetContributionInfoDto;

  @IsOptional()
  @ValidateNested()
  profile?: GetContactProfileDto;

  @IsOptional()
  @ValidateNested()
  roles?: GetContactRoleDto[];
}

export class UpdateContactDto extends BaseContactDto {
  @IsOptional()
  @Validate(IsPassword)
  password?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateContactProfileDto)
  profile?: UpdateContactProfileDto;
}

export class CreateContactDto extends UpdateContactDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ForceUpdateContributionDto)
  contribution?: ForceUpdateContributionDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateContactRoleDto)
  roles?: CreateContactRoleDto[];
}

export interface ExportContactDto {
  Id: string;
  EmailAddress: string;
  FirstName: string;
  LastName: string;
  Joined: string;
  Tags: string;
  ContributionType: ContributionType;
  ContributionMonthlyAmount: number | null;
  ContributionPeriod: ContributionPeriod | null;
  ContributionDescription: string;
  ContributionCancelled: string;
  MembershipStarts: string;
  MembershipExpires: string;
  MembershipStatus: MembershipStatus;
  NewsletterStatus: NewsletterStatus;
  DeliveryOptIn: boolean;
  DeliveryAddressLine1: string;
  DeliveryAddressLine2: string;
  DeliveryAddressCity: string;
  DeliveryAddressPostcode: string;
}

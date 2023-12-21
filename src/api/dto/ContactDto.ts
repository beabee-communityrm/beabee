import {
  ContributionPeriod,
  ContributionType,
  MembershipStatus,
  NewsletterStatus,
  RoleType
} from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidateNested
} from "class-validator";

import { GetPaginatedQuery } from "@api/data/PaginatedData";

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

interface BaseContactDto {
  email: string;
  firstname: string;
  lastname: string;
}

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

export interface GetContactDto extends BaseContactDto {
  id: string;
  joined: Date;
  lastSeen?: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  activeRoles: RoleType[];
  profile?: GetContactProfileDto;
  roles?: GetContactRoleDto[];
  contribution?: ContributionInfo;
}

export class UpdateContactDto implements BaseContactDto {
  @IsEmail()
  email!: string;

  @IsString()
  firstname!: string;

  @IsString()
  lastname!: string;

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

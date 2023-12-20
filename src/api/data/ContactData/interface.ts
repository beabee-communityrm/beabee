import { NewsletterStatus, RoleType, RoleTypes } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidateNested
} from "class-validator";

import IsPassword from "@api/validators/IsPassword";
import { GetPaginatedQuery } from "@api/data/PaginatedData";

import Address from "@models/Address";

import { ForceUpdateContributionDto } from "../../dto/ContributionDto";
import { UUIDParam } from "..";

import { CONTACT_MFA_TYPE } from "@enums/contact-mfa-type";
import { GetContactWith } from "@enums/get-contact-with";

import type { ContactProfileData } from "@type/contact-profile-data";
import type { GetContactRoleData } from "@type/get-contact-role-data";
import type { ContactMfaData } from "@type/contact-mfa-data";
import type { ContactData } from "@type/contact-data";

export class UpdateContactRoleData {
  @Type(() => Date)
  @IsDate()
  dateAdded!: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dateExpires!: Date | null;
}

export class ContactRoleParams extends UUIDParam {
  @IsIn(RoleTypes)
  roleType!: RoleType;
}

export class GetContactQuery {
  @IsArray()
  @IsOptional()
  @IsEnum(GetContactWith, { each: true })
  with?: GetContactWith[];
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

// TODO: Use a mixin to inherit from GetContactQuery?
export class GetContactsQuery extends GetPaginatedQuery {
  @IsArray()
  @IsOptional()
  @IsEnum(GetContactWith, { each: true })
  with?: GetContactWith[];

  @IsIn(contactSortFields)
  sort?: string;
}

class UpdateAddressData implements Address {
  @IsDefined()
  @IsString()
  line1!: string;

  @IsString()
  line2?: string;

  @IsDefined()
  @IsString()
  city!: string;

  @IsDefined()
  @IsString()
  postcode!: string;
}

class UpdateContactProfileData implements Partial<ContactProfileData> {
  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  preferredContact?: string;

  @IsOptional()
  @IsString({ each: true })
  newsletterGroups?: string[];

  @IsOptional()
  @IsBoolean()
  deliveryOptIn?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAddressData)
  deliveryAddress?: UpdateAddressData;

  @IsOptional()
  @IsEnum(NewsletterStatus)
  newsletterStatus?: NewsletterStatus;

  // Admin only

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateContactData implements ContactData {
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
  @Type(() => UpdateContactProfileData)
  profile?: UpdateContactProfileData;
}

class CreateContactRoleData
  extends UpdateContactRoleData
  implements GetContactRoleData
{
  @IsIn(RoleTypes)
  role!: RoleType;
}

export class CreateContactData extends UpdateContactData {
  @IsOptional()
  @ValidateNested()
  @Type(() => ForceUpdateContributionDto)
  contribution?: ForceUpdateContributionDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateContactRoleData)
  roles?: CreateContactRoleData[];
}

/**
 * Get contact multi factor authentication validation data
 */
export class GetContactMfaData implements ContactMfaData {
  @IsString()
  type!: CONTACT_MFA_TYPE;
}

/**
 * Create contact multi factor authentication validation data
 */
export class CreateContactMfaData implements ContactMfaData {
  @IsString()
  secret!: string;

  /** The code from the authenticator app */
  @IsString()
  token!: string;

  @IsString()
  type!: CONTACT_MFA_TYPE;
}

export class DeleteContactMfaData implements ContactMfaData {
  /** The code from the authenticator app, only required by the user itself, not by the admin */
  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  type!: CONTACT_MFA_TYPE;
}

import {
  ContributionPeriod,
  NewsletterStatus,
  PaymentStatus,
  PermissionType,
  PermissionTypes
} from "@beabee/beabee-common";
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

import { ContributionInfo } from "@core/utils";

import IsPassword from "@api/validators/IsPassword";

import Address from "@models/Address";

import { GetPaginatedQuery } from "@api/data/PaginatedData";

interface ContactData {
  email: string;
  firstname: string;
  lastname: string;
}

interface ContactProfileData {
  telephone: string;
  twitter: string;
  preferredContact: string;
  deliveryOptIn: boolean;
  deliveryAddress: Address | null;
  newsletterStatus: NewsletterStatus;
  newsletterGroups: string[];

  // Admin only
  tags?: string[];
  notes?: string;
  description?: string;
}

export class UpdateContactRoleData {
  @Type(() => Date)
  @IsDate()
  dateAdded!: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dateExpires!: Date | null;
}

export interface GetContactRoleData extends UpdateContactRoleData {
  role: PermissionType;
}

export class CreateContactRoleData
  extends UpdateContactRoleData
  implements GetContactRoleData
{
  @IsIn(PermissionTypes)
  role!: PermissionType;
}

export interface GetContactData extends ContactData {
  id: string;
  joined: Date;
  lastSeen?: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  activeRoles: PermissionType[];
  profile?: ContactProfileData;
  roles?: GetContactRoleData[];
  contribution?: ContributionInfo;
}

export enum GetContactWith {
  Contribution = "contribution",
  Profile = "profile",
  Roles = "roles"
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
  @IsString()
  telephone?: string;

  @IsString()
  twitter?: string;

  @IsString()
  preferredContact?: string;

  @IsString({ each: true })
  newsletterGroups?: string[];

  @IsBoolean()
  deliveryOptIn?: boolean;

  @ValidateNested()
  @Type(() => UpdateAddressData)
  deliveryAddress?: UpdateAddressData;

  @IsEnum(NewsletterStatus)
  newsletterStatus?: NewsletterStatus;

  // Admin only
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  notes?: string;

  @IsString()
  description?: string;
}

export class CreateContactData implements ContactData {
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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateContactRoleData)
  roles?: CreateContactRoleData[];
}

export interface GetPaymentData {
  amount: number;
  chargeDate: Date;
  status: PaymentStatus;
}

const paymentSortFields = ["amount", "chargeDate"] as const;
export class GetPaymentsQuery extends GetPaginatedQuery {
  @IsIn(paymentSortFields)
  sort?: string;
}

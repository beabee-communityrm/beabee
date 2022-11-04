import {
  ContributionPeriod,
  NewsletterStatus,
  PaymentStatus,
  PermissionType
} from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsDefined,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Validate,
  ValidateNested
} from "class-validator";

import { ContributionInfo } from "@core/utils";

import IsPassword from "@api/validators/IsPassword";

import Address from "@models/Address";

import { GetPaginatedQuery } from "@api/data/PaginatedData";

interface MemberData {
  email: string;
  firstname: string;
  lastname: string;
}

interface MemberProfileData {
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

export class UpdateMemberRoleData {
  @Type(() => Date)
  @IsDate()
  dateAdded!: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dateExpires!: Date | null;
}

export interface GetMemberRoleData extends UpdateMemberRoleData {
  role: PermissionType;
}

export interface GetMemberData extends MemberData {
  id: string;
  joined: Date;
  lastSeen?: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  activeRoles: PermissionType[];
  profile?: MemberProfileData;
  roles?: GetMemberRoleData[];
  contribution?: ContributionInfo;
}

export enum GetMemberWith {
  Contribution = "contribution",
  Profile = "profile",
  Roles = "roles"
}

export class GetMemberQuery {
  @IsOptional()
  @IsEnum(GetMemberWith, { each: true })
  with?: GetMemberWith[];
}

export class GetMembersQuery extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetMemberWith, { each: true })
  with?: GetMemberWith[];
}

export const memberSortFields = [
  "firstname",
  "lastname",
  "email",
  "joined",
  "lastSeen",
  "contributionMonthlyAmount",
  "membershipStarts",
  "membershipExpires"
] as const;

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

class UpdateMemberProfileData implements Partial<MemberProfileData> {
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

export class UpdateMemberData implements Partial<MemberData> {
  @IsEmail()
  email?: string;

  @IsString()
  firstname?: string;

  @IsString()
  lastname?: string;

  @Validate(IsPassword)
  password?: string;

  @ValidateNested()
  @Type(() => UpdateMemberProfileData)
  profile?: UpdateMemberProfileData;
}

export interface GetPaymentData {
  amount: number;
  chargeDate: Date;
  status: PaymentStatus;
}

export const paymentSortFields = ["amount", "chargeDate"] as const;

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
import { ForceUpdateContributionData } from "../ContributionData";

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

export class CreateMemberRoleData
  extends UpdateMemberRoleData
  implements GetMemberRoleData
{
  @IsIn(PermissionTypes)
  role!: PermissionType;
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
  @IsArray()
  @IsOptional()
  @IsEnum(GetMemberWith, { each: true })
  with?: GetMemberWith[];
}

const memberSortFields = [
  "firstname",
  "lastname",
  "email",
  "joined",
  "lastSeen",
  "contributionMonthlyAmount",
  "membershipStarts",
  "membershipExpires"
] as const;

// TODO: Use a mixin to inherit from GetMemberQuery?
export class GetMembersQuery extends GetPaginatedQuery {
  @IsArray()
  @IsOptional()
  @IsEnum(GetMemberWith, { each: true })
  with?: GetMemberWith[];

  @IsIn(memberSortFields)
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

export class UpdateMemberData implements MemberData {
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
  @Type(() => UpdateMemberProfileData)
  profile?: UpdateMemberProfileData;
}

export class CreateMemberData extends UpdateMemberData {
  @IsOptional()
  @ValidateNested()
  @Type(() => ForceUpdateContributionData)
  contribution?: ForceUpdateContributionData;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateMemberRoleData)
  roles?: CreateMemberRoleData[];
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

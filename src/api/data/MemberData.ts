import IsPassword from "@api/validators/IsPassword";
import { NewsletterStatus } from "@core/providers/newsletter";
import { ContributionInfo, ContributionPeriod } from "@core/utils";
import Address from "@models/Address";
import MemberPermission, { PermissionType } from "@models/MemberPermission";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidateNested
} from "class-validator";
import { GetPaginatedQuery } from ".";

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

export interface GetMemberData extends MemberData {
  id: string;
  joined: Date;
  lastSeen?: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  activeRoles: PermissionType[];
  profile?: MemberProfileData;
  roles?: MemberPermission[];
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

export class GetMembersQuery extends GetPaginatedQuery<
  "firstname" | "email" | "joined"
> {
  @IsIn(["firstname", "email", "joined"])
  sort?: "firstname" | "email" | "joined";

  // TODO: inherit from GetMemberQuery
  @IsOptional()
  @IsEnum(GetMemberWith, { each: true })
  with?: GetMemberWith[];
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

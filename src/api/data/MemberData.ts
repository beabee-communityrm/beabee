import { NewsletterStatus } from "@core/providers/newsletter";
import { ContributionPeriod } from "@core/utils";
import Address from "@models/Address";
import { PermissionType } from "@models/MemberPermission";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

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
  deliveryAddress?: Address;
  newsletterStatus: NewsletterStatus;
  newsletterGroups: string[];

  // Admin only
  tags?: string[];
  notes?: string;
  description?: string;
}

export interface GetMemberData extends MemberData {
  joined: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  profile?: MemberProfileData;
  roles: PermissionType[];
}

export enum GetMemberWith {
  Profile = "profile"
}

export class GetMemberQuery {
  @IsEnum(GetMemberWith, { each: true })
  @IsOptional()
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

  @IsString()
  password?: string;

  @ValidateNested()
  @Type(() => UpdateMemberProfileData)
  profile?: UpdateMemberProfileData;
}

import { NewsletterStatus } from "@core/providers/newsletter";
import { ContributionPeriod, ContributionType } from "@core/utils";
import Address from "@models/Address";
import { PermissionType } from "@models/MemberPermission";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsString,
  ValidateNested
} from "class-validator";

interface MemberData {
  email: string;
  firstname: string;
  lastname: string;
}

interface MemberProfileData {
  deliveryOptIn: boolean;
  deliveryAddress?: Address;
  newsletterStatus: NewsletterStatus;
}

export interface GetMemberData extends MemberData {
  joined: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  profile: MemberProfileData;
  roles: PermissionType[];
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
  @IsBoolean()
  deliveryOptIn?: boolean;

  @ValidateNested()
  @Type(() => UpdateAddressData)
  deliveryAddress?: UpdateAddressData;

  @IsEnum(NewsletterStatus)
  newsletterStatus?: NewsletterStatus;
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

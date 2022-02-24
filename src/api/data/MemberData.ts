import {
  GetPaginatedQuery,
  GetPaginatedRule,
  GetPaginatedRuleGroup,
  transformRules
} from "@api/utils/pagination";
import IsPassword from "@api/validators/IsPassword";
import { NewsletterStatus } from "@core/providers/newsletter";
import { ContributionInfo, ContributionPeriod } from "@core/utils";
import Address from "@models/Address";
import { PermissionType } from "@models/MemberPermission";
import { Transform, Type } from "class-transformer";
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

interface MemberRoleData {
  role: PermissionType;
  dateAdded: Date;
  dateExpires: Date | null;
}

export interface GetMemberData extends MemberData {
  id: string;
  joined: Date;
  lastSeen?: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  activeRoles: PermissionType[];
  profile?: MemberProfileData;
  roles?: MemberRoleData[];
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

const memberFields = [
  "firstname",
  "lastname",
  "email",
  "joined",
  "lastSeen",
  "contributionType",
  "contributionMonthlyAmount",
  "contributionPeriod",
  // Special fields
  "deliveryOptIn",
  "newsletterStatus",
  "activePermission",
  "activeMembership",
  "membershipExpires",
  "tags"
] as const;
const memberSortFields = [
  "firstname",
  "lastname",
  "email",
  "joined",
  "lastSeen",
  "contributionMonthlyAmount"
] as const;

type MemberField = typeof memberFields[number];
type MemberSortField = typeof memberSortFields[number];

class GetMembersRule extends GetPaginatedRule<MemberField> {
  @IsIn(memberFields)
  field!: MemberField;
}

export class GetMembersRuleGroup extends GetPaginatedRuleGroup<MemberField> {
  @Transform(transformRules(GetMembersRuleGroup, GetMembersRule))
  rules!: (GetMembersRuleGroup | GetMembersRule)[];
}

export class GetMembersQuery extends GetPaginatedQuery<
  MemberField,
  MemberSortField
> {
  @IsIn(memberSortFields)
  sort?: MemberSortField;

  @Type(() => GetMembersRuleGroup)
  rules?: GetMembersRuleGroup;

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

export interface GetPaymentData {
  status: string;
  amount: number;
  chargeDate: Date;
}

const paymentFields = ["chargeDate"] as const;
const paymentSortFields = ["amount", "chargeDate"] as const;

type PaymentField = typeof paymentFields[number];
type PaymentSortField = typeof paymentSortFields[number];

class GetPaymentsRule extends GetPaginatedRule<PaymentField> {
  @IsIn(paymentFields)
  field!: PaymentField;
}

class GetPaymentRuleGroup extends GetPaginatedRuleGroup<PaymentField> {
  @Transform(transformRules(GetPaymentRuleGroup, GetPaymentsRule))
  rules!: (GetPaymentRuleGroup | GetPaymentsRule)[];
}

export class GetPaymentsQuery extends GetPaginatedQuery<
  PaymentField,
  PaymentSortField
> {
  @IsIn(paymentSortFields)
  sort?: PaymentSortField;

  @Type(() => GetPaymentRuleGroup)
  rules?: GetPaymentRuleGroup;
}

import { NewsletterStatus } from "@core/providers/newsletter";
import { ContributionPeriod } from "@core/utils";
import {
  Rule,
  RuleGroup,
  RuleField,
  RuleOperator,
  RuleValue,
  isRuleGroup,
  ruleFields
} from "@core/utils/rules";
import Address from "@models/Address";
import { PermissionType } from "@models/MemberPermission";
import {
  plainToClass,
  Transform,
  TransformFnParams,
  Type
} from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
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

export interface GetMemberData extends MemberData {
  id: string;
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

function transformRules({
  value
}: TransformFnParams): GetMembersQueryRule | GetMembersQueryRuleGroup {
  return value.map((v: any) => {
    if (isRuleGroup(v)) {
      return plainToClass(GetMembersQueryRuleGroup, v);
    } else {
      return plainToClass(GetMembersQueryRule, v);
    }
  });
}

class GetMembersQueryRule implements Rule {
  @IsIn(ruleFields)
  field!: RuleField;

  // TODO: Enforce proper validation
  @IsString()
  operator!: RuleOperator;

  @IsString()
  value!: RuleValue | RuleValue[];
}

class GetMembersQueryRuleGroup implements RuleGroup {
  @IsIn(["AND", "OR"])
  condition!: "AND" | "OR";

  @IsArray()
  @ValidateNested()
  @Transform(transformRules)
  rules!: (GetMembersQueryRuleGroup | GetMembersQueryRule)[];
}

export class GetMembersQuery {
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsEnum(GetMemberWith, { each: true })
  with?: GetMemberWith[];

  @IsOptional()
  @IsIn(["firstname", "email", "joined"])
  sort?: "firstname" | "email" | "joined";

  @IsOptional()
  @IsIn(["ASC", "DESC"])
  order?: "ASC" | "DESC";

  @IsOptional()
  @ValidateNested()
  @Type(() => GetMembersQueryRuleGroup)
  rules?: GetMembersQueryRuleGroup;
}

export interface GetMembersData {
  items: GetMemberData[];
  offset: number;
  count: number;
  total: number;
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

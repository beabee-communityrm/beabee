import {
  GetPaginatedQuery,
  GetPaginatedRule,
  GetPaginatedRuleGroup,
  transformRules
} from "@api/utils/pagination";
import IsSlug from "@api/validators/IsSlug";
import IsUrl from "@api/validators/IsUrl";
import ItemStatus from "@models/ItemStatus";
import { PollFormSchema, PollAccess } from "@models/Poll";
import { PollResponseAnswers } from "@models/PollResponse";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString
} from "class-validator";

const fields = [
  "title",
  "status",
  "answeredBy",
  "starts",
  "expires",
  "hidden"
] as const;
const sortFields = ["title", "starts", "expires"] as const;

type Field = typeof fields[number];
type SortField = typeof sortFields[number];

class GetCalloutsRule extends GetPaginatedRule<Field> {
  @IsIn(fields)
  field!: Field;
}

class GetCalloutsRuleGroup extends GetPaginatedRuleGroup<Field> {
  @Transform(transformRules(GetCalloutsRuleGroup, GetCalloutsRule))
  rules!: (GetCalloutsRuleGroup | GetCalloutsRule)[];
}

export class GetCalloutsQuery extends GetPaginatedQuery<Field, SortField> {
  @IsIn(sortFields)
  sort?: SortField;

  @Type(() => GetCalloutsRuleGroup)
  rules?: GetCalloutsRuleGroup;

  @IsOptional()
  @IsString()
  hasAnswered?: string;
}

interface BasicCalloutData {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  starts: Date | null;
  expires: Date | null;
  allowUpdate: boolean;
  allowMultiple: boolean;
  access: PollAccess;
  hidden: boolean;
}

interface MoreCalloutData extends BasicCalloutData {
  intro: string;
  thanksTitle: string;
  thanksText: string;
  thanksRedirect?: string;
  shareTitle?: string;
  shareDescription?: string;
  formSchema: PollFormSchema;
}

export interface GetBasicCalloutData extends BasicCalloutData {
  status: ItemStatus;
  hasAnswered?: boolean;
}

export interface GetMoreCalloutData
  extends GetBasicCalloutData,
    MoreCalloutData {}

export class UpdateCalloutData implements Omit<MoreCalloutData, "slug"> {
  @IsString()
  title!: string;

  @IsString()
  excerpt!: string;

  @IsUrl()
  image!: string;

  @IsString()
  intro!: string;

  @IsString()
  thanksTitle!: string;

  @IsString()
  thanksText!: string;

  @IsOptional()
  @IsUrl()
  thanksRedirect?: string;

  @IsOptional()
  @IsString()
  shareTitle?: string;

  @IsOptional()
  @IsString()
  shareDescription?: string;

  @IsObject()
  formSchema!: PollFormSchema;

  @Type(() => Date)
  @IsDate()
  starts!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expires!: Date | null;

  @IsBoolean()
  allowUpdate!: boolean;

  @IsBoolean()
  allowMultiple!: boolean;

  @IsEnum(PollAccess)
  access!: PollAccess;

  @IsBoolean()
  hidden!: boolean;
}

export class CreateCalloutData
  extends UpdateCalloutData
  implements MoreCalloutData
{
  @IsSlug()
  slug!: string;
}

const responseFields = ["member", "poll"] as const;
const responseSortFields = ["createdAt", "updatedAt"] as const;

type ResponseField = typeof responseFields[number];
type ResponseSortField = typeof responseSortFields[number];

class GetCalloutResponsesRule extends GetPaginatedRule<ResponseField> {
  @IsIn(responseFields)
  field!: ResponseField;
}

class GetCalloutResponsesRuleGroup extends GetPaginatedRuleGroup<ResponseField> {
  @Transform(
    transformRules(GetCalloutResponsesRuleGroup, GetCalloutResponsesRule)
  )
  rules!: (GetCalloutResponsesRuleGroup | GetCalloutResponsesRule)[];
}

export class GetCalloutResponsesQuery extends GetPaginatedQuery<
  ResponseField,
  ResponseSortField
> {
  @IsIn(responseSortFields)
  sort?: ResponseSortField;

  @Type(() => GetCalloutResponsesRuleGroup)
  rules?: GetCalloutResponsesRuleGroup;
}

export interface GetCalloutResponseData {
  member: string;
  answers: PollResponseAnswers;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateCalloutResponseData {
  @IsObject()
  answers!: PollResponseAnswers;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsEmail()
  guestEmail?: string;
}

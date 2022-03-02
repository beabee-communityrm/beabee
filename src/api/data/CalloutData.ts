import {
  GetPaginatedQuery,
  GetPaginatedRule,
  GetPaginatedRuleGroup,
  transformRules
} from "@api/utils/pagination";
import { PollResponseAnswers } from "@models/PollResponse";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export enum CalloutStatus {
  Open = "open",
  Finished = "finished"
}

const fields = ["title", "status", "answeredBy"] as const;
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

  @IsOptional()
  @IsBoolean()
  onlyHasAnswered?: boolean;
}

export interface GetBasicCalloutData {
  slug: string;
  title: string;
  excerpt: string;
  image?: string;
  starts?: Date;
  expires?: Date;
  hasAnswered?: boolean;
}

export interface GetMoreCalloutData extends GetBasicCalloutData {
  templateSchema?: Record<string, unknown>;
}

const responseFields = ["member"] as const;
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

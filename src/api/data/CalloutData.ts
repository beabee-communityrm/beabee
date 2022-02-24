import {
  GetPaginatedQuery,
  GetPaginatedRule,
  GetPaginatedRuleGroup,
  transformRules
} from "@api/utils/pagination";
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

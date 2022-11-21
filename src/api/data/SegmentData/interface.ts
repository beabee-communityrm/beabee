import { RuleGroup } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

import { GetPaginatedRuleGroup } from "../PaginatedData";

export enum GetSegmentWith {
  contactCount = "contactCount"
}

export class GetSegmentQuery {
  @IsOptional()
  @IsEnum(GetSegmentWith, { each: true })
  with?: GetSegmentWith[];
}

export class CreateSegmentData {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  ruleGroup!: GetPaginatedRuleGroup;

  @IsOptional()
  @IsNumber()
  order?: number;
}
export interface GetSegmentData extends CreateSegmentData {
  id: string;
  contactCount?: number;
}

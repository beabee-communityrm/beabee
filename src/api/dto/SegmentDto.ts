import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

import {
  GetPaginatedQuery,
  GetPaginatedRuleGroup
} from "@api/data/PaginatedData";

export enum GetSegmentWith {
  contactCount = "contactCount"
}

export class CreateSegmentDto {
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

export interface GetSegmentDto extends CreateSegmentDto {
  id: string;
  contactCount?: number;
}

export class GetSegmentOptsDto {
  @IsOptional()
  @IsEnum(GetSegmentWith, { each: true })
  with?: GetSegmentWith[];
}

export class ListSegmentsDto extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetSegmentWith, { each: true })
  with?: GetSegmentWith[];

  @IsOptional()
  @IsIn(["name", "description", "order"])
  sort?: string;
}

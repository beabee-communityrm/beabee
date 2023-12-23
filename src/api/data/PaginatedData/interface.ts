import {
  PaginatedQuery,
  Rule,
  ruleOperators,
  RuleOperator,
  RuleValue,
  RuleGroup
} from "@beabee/beabee-common";
import { Transform, Type } from "class-transformer";
import {
  IsString,
  IsIn,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
  Max
} from "class-validator";

import { IsType } from "@api/validators/IsType";
import { transformRules } from "@api/utils/rules";

export class GetPaginatedRule implements Rule {
  @IsString()
  field!: string;

  @IsIn(ruleOperators)
  operator!: RuleOperator;

  @IsArray()
  @IsType(["string", "boolean", "number"], { each: true })
  value!: RuleValue[];
}

export type GetPaginatedRuleGroupRule =
  | GetPaginatedRuleGroup
  | GetPaginatedRule;

export class GetPaginatedRuleGroup implements RuleGroup {
  @IsIn(["AND", "OR"])
  condition!: "AND" | "OR";

  @IsArray()
  @ValidateNested({ each: true })
  @Transform(transformRules)
  rules!: GetPaginatedRuleGroupRule[];
}

export class GetExportQuery {
  @IsOptional()
  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  rules?: GetPaginatedRuleGroup;
}

export class GetPaginatedQuery
  extends GetExportQuery
  implements PaginatedQuery
{
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(["ASC", "DESC"])
  order?: "ASC" | "DESC";
}

import {
  PaginatedQuery,
  Rule,
  ruleOperators,
  RuleOperator,
  RuleValue,
  RuleGroup,
  FilterType
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
import { WhereExpressionBuilder } from "typeorm";

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

export type RichRuleValue = RuleValue | Date;

export interface FilterHandlerArgs {
  fieldPrefix: string;
  type: FilterType;
  field: string;
  operator: RuleOperator;
  value: RichRuleValue[];
  whereFn: (field: string) => string;
  suffixFn: (field: string) => string;
}

export type FilterHandler = (
  qb: WhereExpressionBuilder,
  args: FilterHandlerArgs
) => void | Record<string, unknown>;

export type FilterHandlers<Field extends string> = {
  [K in Field]?: FilterHandler;
};

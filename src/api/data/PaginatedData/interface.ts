import {
  PaginatedQuery,
  Rule,
  ruleOperators,
  RuleOperator,
  RuleValue,
  RuleGroup,
  isRuleGroup,
  FilterType
} from "@beabee/beabee-common";
import {
  plainToClass,
  Transform,
  TransformFnParams,
  Type
} from "class-transformer";
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

export { Paginated } from "@beabee/beabee-common";

function transformRules({
  value
}: TransformFnParams): GetPaginatedRuleGroupRule {
  return value.map((v: GetPaginatedRuleGroupRule) =>
    plainToClass<GetPaginatedRuleGroupRule, unknown>(
      isRuleGroup(v) ? GetPaginatedRuleGroup : GetPaginatedRule,
      v
    )
  );
}

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

export interface FieldHandlerArgs {
  fieldPrefix: string;
  type: FilterType;
  field: string;
  operator: RuleOperator;
  value: RichRuleValue[];
  whereFn: (field: string) => string;
  suffixFn: (field: string) => string;
}

export type FieldHandler = (
  qb: WhereExpressionBuilder,
  args: FieldHandlerArgs
) => void | Record<string, unknown>;

export type FieldHandlers<Field extends string> = {
  [K in Field]?: FieldHandler;
};

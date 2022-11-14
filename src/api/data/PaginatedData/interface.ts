import {
  PaginatedQuery,
  Rule,
  ruleOperators,
  RuleOperator,
  RuleValue,
  RuleGroup,
  isRuleGroup
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

export class GetPaginatedQuery implements PaginatedQuery {
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

  @IsOptional()
  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  rules?: GetPaginatedRuleGroup;
}

export type RichRuleValue = RuleValue | Date;

export type SpecialFields<Field extends string> = Partial<
  Record<
    Field,
    (
      qb: WhereExpressionBuilder,
      args: {
        operator: RuleOperator;
        field: Field;
        whereFn: (field: string) => string;
        values: RichRuleValue[];
      }
    ) => void
  >
>;

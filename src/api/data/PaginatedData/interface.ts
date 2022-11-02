import {
  PaginatedQuery,
  Rule,
  ruleOperators,
  RuleOperator,
  RuleValue,
  RuleGroup,
  ValidatedRule
} from "@beabee/beabee-common";
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

export class GetPaginatedRule implements Rule {
  @IsString()
  field!: string;

  @IsIn(ruleOperators)
  operator!: RuleOperator;

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
  @ValidateNested()
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
  rules?: GetPaginatedRuleGroup;
}

export type SpecialFields<Field extends string> = Partial<
  Record<
    Field,
    (
      rule: ValidatedRule<Field>,
      qb: WhereExpressionBuilder,
      suffix: string,
      namedWhere: string
    ) => Record<string, unknown> | undefined | void
  >
>;

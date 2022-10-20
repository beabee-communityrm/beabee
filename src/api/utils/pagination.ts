import { IsType } from "@api/validators/IsType";
import {
  Filters,
  GetPaginatedQueryRule,
  GetPaginatedQueryRuleGroup,
  GetPaginatedQueryRuleOperator,
  GetPaginatedQueryRuleValue,
  operators,
  validateRuleGroup
} from "@beabee/beabee-common";
import { buildRuleQuery, SpecialFields } from "@core/utils/newRules";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { BadRequestError } from "routing-controllers";
import { EntityTarget, SelectQueryBuilder } from "typeorm";

export interface Paginated<T> {
  items: T[];
  offset: number;
  count: number;
  total: number;
}

export class GetPaginatedRule implements GetPaginatedQueryRule<string> {
  @IsString()
  field!: string;

  @IsIn(operators)
  operator!: GetPaginatedQueryRuleOperator;

  @IsType(["string", "boolean", "number"], { each: true })
  value!: GetPaginatedQueryRuleValue[];
}

type GetPaginatedRuleGroupRule = GetPaginatedRuleGroup | GetPaginatedRule;

export class GetPaginatedRuleGroup
  implements GetPaginatedQueryRuleGroup<string>
{
  @IsIn(["AND", "OR"])
  condition!: "AND" | "OR";

  @IsArray()
  @ValidateNested()
  rules!: GetPaginatedRuleGroupRule[];
}

export class GetPaginatedQuery {
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

export async function fetchPaginated<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  filters: Filters<Field>,
  query: GetPaginatedQuery,
  specialFields?: SpecialFields<Field>,
  queryCallback?: (qb: SelectQueryBuilder<Entity>) => void
): Promise<Paginated<Entity>> {
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  if (query.rules && !validateRuleGroup(filters, query.rules)) {
    throw new BadRequestError();
  }

  const qb = buildRuleQuery(entity, filters, query.rules, specialFields)
    .offset(offset)
    .limit(limit);
  if (query.sort) {
    qb.orderBy({ [`item."${query.sort}"`]: query.order || "ASC" });
  }

  if (queryCallback) {
    queryCallback(qb);
  }

  const [items, total] = await qb.getManyAndCount();

  return {
    total,
    offset,
    count: items.length,
    items
  };
}

export function mergeRules(
  query: GetPaginatedQuery,
  extraRules?: (GetPaginatedRuleGroupRule | undefined | false)[] | false
): GetPaginatedQuery {
  if (!extraRules) return query;

  return {
    ...query,
    rules: {
      condition: "AND",
      rules: [
        ...(extraRules.filter((rule) => !!rule) as GetPaginatedRuleGroupRule[]),
        ...(query.rules ? [query.rules] : [])
      ]
    }
  };
}

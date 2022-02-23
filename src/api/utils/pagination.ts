import {
  buildRuleQuery,
  Rule,
  RuleGroup,
  RuleOperator,
  RuleValue,
  SpecialFields
} from "@core/utils/newRules";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { EntityTarget, SelectQueryBuilder } from "typeorm";

export interface Paginated<T> {
  items: T[];
  offset: number;
  count: number;
  total: number;
}

export abstract class GetPaginatedRule<Field extends string>
  implements Rule<Field>
{
  field!: Field;

  // TODO: operator validation
  @IsString()
  operator!: RuleOperator;

  // TODO: allow RuleValue[]
  @IsString()
  value!: RuleValue | RuleValue[];
}

export abstract class GetPaginatedRuleGroup<Field extends string>
  implements RuleGroup<Field>
{
  @IsIn(["AND", "OR"])
  condition!: "AND" | "OR";

  @IsArray()
  @ValidateNested()
  rules!: (GetPaginatedRuleGroup<Field> | GetPaginatedRule<Field>)[];
}

export abstract class GetPaginatedQuery<
  Field extends string,
  SortField extends string
> {
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Min(0)
  offset?: number;

  @IsOptional()
  sort?: SortField;

  @IsOptional()
  @IsIn(["ASC", "DESC"])
  order?: "ASC" | "DESC";

  @IsOptional()
  @ValidateNested()
  rules?: GetPaginatedRuleGroup<Field>;
}

export async function fetchPaginated<
  Entity,
  Field extends string,
  SortField extends string
>(
  entity: EntityTarget<Entity>,
  query: GetPaginatedQuery<Field, SortField>,
  queryCallback?: (qb: SelectQueryBuilder<Entity>) => void,
  specialFields?: SpecialFields<Field>
): Promise<Paginated<Entity>> {
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  const qb = buildRuleQuery(entity, query.rules, specialFields)
    .offset(offset)
    .limit(limit);
  if (query.sort) {
    qb.orderBy({ [query.sort]: query.order || "ASC" });
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

import { IsType } from "@api/validators/IsType";
import {
  buildRuleQuery,
  isRuleGroup,
  Rule,
  RuleGroup,
  RuleOperator,
  RuleValue,
  SpecialFields
} from "@core/utils/newRules";
import {
  ClassConstructor,
  plainToClass,
  TransformFnParams
} from "class-transformer";
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

  @IsType(["string", "boolean", "number"], { each: true })
  value!: RuleValue | RuleValue[];
}

type GetPaginatedRuleGroupRule<Field extends string> =
  | GetPaginatedRuleGroup<Field>
  | GetPaginatedRule<Field>;

export abstract class GetPaginatedRuleGroup<Field extends string>
  implements RuleGroup<Field>
{
  @IsIn(["AND", "OR"])
  condition!: "AND" | "OR";

  @IsArray()
  @ValidateNested()
  rules!: GetPaginatedRuleGroupRule<Field>[];
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

export function transformRules<
  F extends string,
  RG extends GetPaginatedRuleGroup<F>,
  R extends GetPaginatedRule<F>
>(RuleGroup: ClassConstructor<RG>, Rule: ClassConstructor<R>) {
  return ({ value }: TransformFnParams): RG | R => {
    return value.map((v: RG | R) =>
      plainToClass<RG | R, unknown>(isRuleGroup<F>(v) ? RuleGroup : Rule, v)
    );
  };
}

export async function fetchPaginated<
  Entity,
  Field extends string,
  SortField extends string
>(
  entity: EntityTarget<Entity>,
  query: GetPaginatedQuery<Field, SortField>,
  specialFields?: SpecialFields<Field>,
  queryCallback?: (qb: SelectQueryBuilder<Entity>) => void
): Promise<Paginated<Entity>> {
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  const qb = buildRuleQuery(entity, query.rules, specialFields)
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

export function mergeRules<Field extends string, SortField extends string>(
  query: GetPaginatedQuery<Field, SortField>,
  extraRules?: (GetPaginatedRuleGroupRule<Field> | undefined | false)[] | false
): GetPaginatedQuery<Field, SortField> {
  if (!extraRules) return query;

  return {
    ...query,
    rules: {
      condition: "AND",
      rules: [
        ...(extraRules.filter(
          (rule) => !!rule
        ) as GetPaginatedRuleGroupRule<Field>[]),
        ...(query.rules ? [query.rules] : [])
      ]
    }
  };
}

import {
  Filters,
  Rule,
  RuleGroup,
  RuleValue,
  isRuleGroup,
  validateRuleGroup
} from "@beabee/beabee-common";
import { BadRequestError } from "routing-controllers";
import {
  Brackets,
  createQueryBuilder,
  EntityTarget,
  SelectQueryBuilder,
  WhereExpressionBuilder
} from "typeorm";

import Member from "@models/Member";

import {
  GetPaginatedQuery,
  GetPaginatedRuleGroupRule,
  Paginated,
  SpecialFields
} from "./interface";

type RichRuleValue = RuleValue | Date;

const operators = {
  equal: (v: RichRuleValue[]) => ["= :a", { a: v[0] }] as const,
  not_equal: (v: RichRuleValue[]) => ["<> :a", { a: v[0] }] as const,
  in: (v: RichRuleValue[]) => ["IN (:...v)", { v }] as const,
  not_in: (v: RichRuleValue[]) => ["NOT IN (:...v)", { v }] as const,
  less: (v: RichRuleValue[]) => ["< :a", { a: v[0] }] as const,
  less_or_equal: (v: RichRuleValue[]) => ["<= :a", { a: v[0] }] as const,
  greater: (v: RichRuleValue[]) => ["> :a", { a: v[0] }] as const,
  greater_or_equal: (v: RichRuleValue[]) => [">= :a", { a: v[0] }] as const,
  between: (v: RichRuleValue[]) =>
    ["BETWEEN :a AND :b", { a: v[0], b: v[1] }] as const,
  not_between: (v: RichRuleValue[]) =>
    ["NOT BETWEEN :a AND :b", { a: v[0], b: v[1] }] as const,
  begins_with: (v: RichRuleValue[]) => ["ILIKE :a", { a: v[0] + "%" }] as const,
  not_begins_with: (v: RichRuleValue[]) =>
    ["NOT ILIKE :a", { a: v[0] + "%" }] as const,
  contains: (v: RichRuleValue[]) =>
    ["ILIKE :a", { a: "%" + v[0] + "%" }] as const,
  not_contains: (v: RichRuleValue[]) =>
    ["NOT ILIKE :a", { a: "%" + v[0] + "%" }] as const,
  ends_with: (v: RichRuleValue[]) => ["ILIKE :a", { a: "%" + v[0] }] as const,
  not_ends_with: (v: RichRuleValue[]) =>
    ["NOT ILIKE :a", { a: "%" + v[0] }] as const,
  is_empty: () => ["= ''", {}] as const,
  is_not_empty: () => ["<> ''", {}] as const,
  is_null: () => ["IS NULL", {}] as const,
  is_not_null: () => ["IS NOT NULL", {}] as const
} as const;

function parseValue<Field extends string>(rule: Rule<Field>): RichRuleValue {
  // if (typeof value === "string") {
  //   if (value.startsWith("$now")) {
  //     const date = moment.utc();
  //     const match = /\$now(\((?:(?:y|M|d|h|m|s):(?:-?\d+),?)+\))?/.exec(value);
  //     if (match && match[1]) {
  //       for (const modifier of match[1].matchAll(/(y|M|d|h|m|s):(-?\d+)/g)) {
  //         date.add(modifier[2], modifier[1] as DurationInputArg2);
  //       }
  //     }
  //     return date.toDate();
  //   }
  //   return value;
  // } else {
  //   return value;
  // }
  return rule.value[0];
}

export function buildPaginatedQuery<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  filters: Filters<Field>,
  ruleGroup?: RuleGroup<Field>,
  specialFields?: SpecialFields<Field>
): SelectQueryBuilder<Entity> {
  const params: Record<string, unknown> = {};
  let paramNo = 0;

  function parseRule(rule: Rule<Field>) {
    return (qb: WhereExpressionBuilder): void => {
      const parsedValues = rule.value.map(parseValue);

      const [where, ruleParams] = operators[rule.operator](parsedValues);

      // Horrible code to make sure param names are unique
      const suffix = "_" + paramNo;
      for (const paramKey in ruleParams) {
        params[paramKey + suffix] =
          ruleParams[paramKey as keyof typeof ruleParams];
      }
      const namedWhere = where.replace(/:((\.\.\.)?[a-z])/g, `:$1${suffix}`);

      const specialField = specialFields && specialFields[rule.field];
      if (specialField) {
        const specialRuleParams = specialField(rule, qb, suffix, namedWhere);
        if (specialRuleParams) {
          for (const paramKey in specialRuleParams) {
            params[paramKey + suffix] = specialRuleParams[paramKey];
          }
        }
      } else {
        qb.where(`item.${rule.field} ${namedWhere}`);
      }

      paramNo++;
    };
  }

  function parseRuleGroup(ruleGroup: RuleGroup<Field>) {
    return (qb: WhereExpressionBuilder): void => {
      qb.where(ruleGroup.condition === "AND" ? "TRUE" : "FALSE");
      const conditionFn =
        ruleGroup.condition === "AND"
          ? ("andWhere" as const)
          : ("orWhere" as const);
      for (const rule of ruleGroup.rules) {
        qb[conditionFn](
          new Brackets(
            isRuleGroup(rule) ? parseRuleGroup(rule) : parseRule(rule)
          )
        );
      }
    };
  }

  const qb = createQueryBuilder(entity, "item");
  if (ruleGroup) {
    const where = new Brackets(parseRuleGroup(ruleGroup));
    qb.where(where).setParameters(params);
  }
  return qb;
}

export async function fetchPaginated<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  filters: Filters<Field>,
  query: GetPaginatedQuery,
  member?: Member,
  specialFields?: SpecialFields<Field>,
  queryCallback?: (qb: SelectQueryBuilder<Entity>) => void
): Promise<Paginated<Entity>> {
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  if (query.rules && !validateRuleGroup(filters, query.rules)) {
    throw new BadRequestError();
  }

  const qb = buildPaginatedQuery(entity, filters, query.rules, specialFields)
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

export * from "./interface";

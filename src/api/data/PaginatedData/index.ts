import {
  Filters,
  RuleValue,
  isRuleGroup,
  validateRuleGroup,
  ValidatedRule,
  ValidatedRuleGroup
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
import { parseISO, sub } from "date-fns";

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

const durations = {
  y: "years",
  M: "months",
  d: "days",
  h: "hours",
  m: "minutes",
  s: "seconds"
} as const;

// Convert relative dates
export function parseDate(value: string): Date {
  if (value.startsWith("$now")) {
    let date = new Date();
    const match = /\$now(\((?:(?:y|M|d|h|m|s):(?:-?\d+),?)+\))?/.exec(value);
    if (match && match[1]) {
      for (const [period, delta] of match[1].matchAll(
        /(y|M|d|h|m|s):(-?\d+)/g
      )) {
        date = sub(date, {
          [durations[period as keyof typeof durations]]: Number(delta)
        });
      }
    }
    return date;
  } else {
    return parseISO(value);
  }
}

export function buildPaginatedQuery<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  filters: Filters<Field>,
  ruleGroup: ValidatedRuleGroup<Field> | undefined,
  member?: Member,
  specialFields?: SpecialFields<Field>
): SelectQueryBuilder<Entity> {
  const params: Record<string, unknown> = {};
  let paramNo = 0;

  function parseRuleValues(rule: ValidatedRule<Field>): RichRuleValue[] {
    if (rule.type === "date") {
      return rule.value.map(parseDate);
    }
    if (rule.type === "contact") {
      // Map "me" to member id
      return rule.value.map((v) => (v === "me" && member ? member.id : ""));
    }
    return rule.value;
  }

  function parseRule(rule: ValidatedRule<Field>) {
    return (qb: WhereExpressionBuilder): void => {
      const values = parseRuleValues(rule);

      const [where, ruleParams] = operators[rule.operator](values);

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

  function parseRuleGroup(ruleGroup: ValidatedRuleGroup<Field>) {
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

  const ruleGroup = query.rules && validateRuleGroup(filters, query.rules);
  if (ruleGroup === false) {
    throw new BadRequestError();
  }

  const qb = buildPaginatedQuery(
    entity,
    filters,
    ruleGroup,
    member,
    specialFields
  )
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

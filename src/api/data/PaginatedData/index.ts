import {
  Filters,
  isRuleGroup,
  validateRuleGroup,
  ValidatedRule,
  ValidatedRuleGroup,
  ItemStatus,
  RuleOperator,
  FilterType,
  operatorsByType,
  FilterOperator,
  InvalidRule
} from "@beabee/beabee-common";
import { BadRequestError } from "routing-controllers";
import {
  Brackets,
  createQueryBuilder,
  EntityTarget,
  SelectQueryBuilder,
  WhereExpressionBuilder
} from "typeorm";

import { getMinDateUnit, parseDate } from "@core/utils/date";

import Member from "@models/Member";

import {
  GetPaginatedQuery,
  GetPaginatedRuleGroupRule,
  Paginated,
  RichRuleValue,
  SpecialFields
} from "./interface";

const equalityOperatorsWhere = {
  equal: (field: string) => `${field} = :a`,
  not_equal: (field: string) => `${field} <> :a`
};

const nullableOperatorsWhere = {
  is_empty: (field: string) => `${field} IS NULL`,
  is_not_empty: (field: string) => `${field} IS NOT NULL`
};

const numericOperatorsWhere = {
  ...equalityOperatorsWhere,
  ...nullableOperatorsWhere,
  less: (field: string) => `${field} < :a`,
  less_or_equal: (field: string) => `${field} <= :a`,
  greater: (field: string) => `${field} > :a`,
  greater_or_equal: (field: string) => `${field} >= :a`,
  between: (field: string) => `${field} BETWEEN :a AND :b`,
  not_between: (field: string) => `${field} NOT BETWEEN :a AND :b`,
  is_empty: (field: string) => `${field} IS NULL`,
  is_not_empty: (field: string) => `${field} IS NOT NULL`
};

function withOperators<T extends FilterType>(
  type: T,
  operators: Record<
    keyof typeof operatorsByType[T] | "is_empty" | "is_not_empty",
    (field: string) => string
  >
) {
  return operators;
}

const operatorsWhereByType: Record<
  FilterType,
  Partial<Record<FilterOperator, (field: string) => string>>
> = {
  text: withOperators("text", {
    ...equalityOperatorsWhere,
    begins_with: (field) => `${field} ILIKE :a || '%'`,
    not_begins_with: (field) => `${field} NOT ILIKE :a || '%'`,
    ends_with: (field) => `${field} ILIKE '%' || :a`,
    not_ends_with: (field) => `${field} NOT ILIKE '%' || :a`,
    contains: (field) => `${field} ILIKE '%' || :a || '%'`,
    not_contains: (field) => `${field} NOT ILIKE '%' || :a || '%'`,
    is_empty: (field) => `${field} = ''`,
    is_not_empty: (field) => `${field} <> ''`
  }),
  date: withOperators("date", numericOperatorsWhere),
  number: withOperators("number", numericOperatorsWhere),
  boolean: withOperators("boolean", {
    ...nullableOperatorsWhere,
    equal: equalityOperatorsWhere.equal
  }),
  array: withOperators("array", {
    contains: (field) => `${field} ? :a`,
    not_contains: (field) => `${field} ? :a = FALSE`,
    is_empty: (field) => `${field} ->> 0 IS NULL`,
    is_not_empty: (field) => `${field} ->> 0 IS NOT NULL`
  }),
  enum: withOperators("enum", {
    ...equalityOperatorsWhere,
    ...nullableOperatorsWhere
  }),
  contact: withOperators("contact", {
    ...equalityOperatorsWhere,
    ...nullableOperatorsWhere
  })
} as const;

export function statusField(
  qb: WhereExpressionBuilder,
  args: { operator: RuleOperator; values: RichRuleValue[] }
) {
  // TODO: handle other operators
  if (args.operator !== "equal") {
    throw new BadRequestError("Status field only supports equal operator");
  }

  switch (args.values[0]) {
    case ItemStatus.Draft:
      return qb.andWhere(`item.starts IS NULL`);
    case ItemStatus.Scheduled:
      return qb.andWhere(`item.starts > :now`);
    case ItemStatus.Open:
      return qb.andWhere(`item.starts < :now`).andWhere(
        new Brackets((qb) => {
          qb.where("item.expires IS NULL").orWhere(`item.expires > :now`);
        })
      );
    case ItemStatus.Ended:
      return qb.andWhere(`item.starts < :now`).andWhere(`item.expires < :now`);
  }
}

const dateUnitSql = {
  y: "year",
  M: "month",
  d: "day",
  h: "hour",
  m: "minute",
  s: "second"
} as const;

function prepareRule(
  rule: ValidatedRule<string>,
  member: Member | undefined
): [(field: string) => string, RichRuleValue[]] {
  const whereFn = operatorsWhereByType[rule.type][rule.operator];
  // This should never happen as a ValidatedRule can't have an invalid type/operator combo
  if (!whereFn) {
    throw new Error("Invalid ValidatedRule");
  }

  if (rule.type === "text") {
    // Make NULL an empty string for comparison
    return [(field) => whereFn(`COALESCE(${field}, '')`), rule.value];
  } else if (rule.type === "date") {
    // Compare dates using the lowest resolution date unit provided
    const values = rule.value.map((v) => parseDate(v));
    const minUnit = getMinDateUnit(values.map(([_, unit]) => unit)) || "d";
    return [
      (field) => whereFn(`DATE_TRUNC('${dateUnitSql[minUnit]}', ${field})`),
      values.map(([date]) => date)
    ];
  }

  return [
    whereFn,
    rule.type === "contact"
      ? rule.value.map((v) => (v === "me" && member?.id) || "")
      : rule.value
  ];
}

export function buildPaginatedQuery<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  filters: Filters<Field>,
  ruleGroup: ValidatedRuleGroup<Field> | undefined,
  member?: Member,
  specialFields?: SpecialFields<Field>
): SelectQueryBuilder<Entity> {
  /*
    The query builder doesn't support having the same parameter names for
    different parts of the query and subqueries, so we have to ensure each query
    parameter has a unique name. We do this by appending a suffix "_<ruleNo>" to
    the end of each parameter for each rule.
  */
  const params: Record<string, unknown> = {
    // Some queries need a current date parameter
    now: new Date()
  };

  let ruleNo = 0;

  function parseRule(rule: ValidatedRule<Field>) {
    return (qb: WhereExpressionBuilder): void => {
      const [whereFn, values] = prepareRule(rule, member);
      const suffix = "_" + ruleNo;

      // Add values as params
      params["a" + suffix] = values[0];
      params["b" + suffix] = values[1];

      const whereFnWithSuffix = (field: string) =>
        whereFn(field)
          .replace(":a", ":a" + suffix)
          .replace(":b", ":b" + suffix);

      const specialField = specialFields?.[rule.field];
      if (specialField) {
        specialField(qb, { ...rule, whereFn: whereFnWithSuffix, values });
      } else {
        qb.where(whereFnWithSuffix(`item.${rule.field}`));
      }

      ruleNo++;
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

  try {
    const ruleGroup = query.rules && validateRuleGroup(filters, query.rules);

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
  } catch (err) {
    if (err instanceof InvalidRule) {
      const err2: any = new BadRequestError(err.message);
      err2.rule = err.rule;
      throw err2;
    } else {
      throw err;
    }
  }
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

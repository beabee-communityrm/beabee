import {
  Filters,
  isRuleGroup,
  validateRuleGroup,
  ValidatedRule,
  ValidatedRuleGroup,
  ItemStatus,
  RuleOperator
} from "@beabee/beabee-common";
import { BadRequestError } from "routing-controllers";
import {
  Brackets,
  createQueryBuilder,
  EntityTarget,
  SelectQueryBuilder,
  WhereExpressionBuilder
} from "typeorm";

import { parseDate } from "@core/utils/date";

import Member from "@models/Member";

import {
  GetPaginatedQuery,
  GetPaginatedRuleGroupRule,
  Paginated,
  RichRuleValue,
  SpecialFields
} from "./interface";

const operatorWhere: Record<RuleOperator, string> = {
  equal: "= :a",
  not_equal: "<> :a",
  less: "< :a",
  less_or_equal: "<= :a",
  greater: "> :a",
  greater_or_equal: ">= :a",
  between: "BETWEEN :a AND :b",
  not_between: "NOT BETWEEN :a AND :b",
  begins_with: "ILIKE :a",
  not_begins_with: "NOT ILIKE :a",
  contains: "ILIKE :a",
  not_contains: "NOT ILIKE :a",
  ends_with: "ILIKE :a",
  not_ends_with: "NOT ILIKE :a",
  is_empty: "= ''",
  is_not_empty: "<> ''"
};

export function statusField(
  qb: WhereExpressionBuilder,
  args: { operator: RuleOperator; values: RichRuleValue[] }
) {
  // TODO: handle other operators or error
  if (args.operator !== "equal") return;

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

  function parseRuleValues(rule: ValidatedRule<Field>): RichRuleValue[] {
    if (rule.type === "date") {
      return rule.value.map(parseDate);
    }
    if (rule.type === "contact") {
      // Map "me" to member id
      return rule.value.map((v) => (v === "me" && member?.id) || "");
    }
    return rule.value;
  }

  function parseRule(rule: ValidatedRule<Field>) {
    return (qb: WhereExpressionBuilder): void => {
      const values = parseRuleValues(rule);
      const suffix = "_" + ruleNo;

      // Add values as params
      params["a" + suffix] = values[0];
      params["b" + suffix] = values[1];

      // Add suffix to placeholders
      const where = operatorWhere[rule.operator]
        .replace(":a", ":a" + suffix)
        .replace(":b", ":b" + suffix);

      const specialField = specialFields?.[rule.field];
      if (specialField) {
        specialField(qb, { ...rule, suffix, where, values });
      } else {
        qb.where(`item.${rule.field} ${where}`);
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

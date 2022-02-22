import moment, { DurationInputArg2 } from "moment";
import {
  Brackets,
  createQueryBuilder,
  EntityTarget,
  SelectQueryBuilder,
  WhereExpressionBuilder
} from "typeorm";

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
  is_not_null: () => ["IS NOT NULL", {}] as const,
  contains_jsonb: (v: RichRuleValue[]) => ["? :a", { a: v[0] }] as const
} as const;

export type RuleValue = string | number | boolean;
export type RuleOperator = keyof typeof operators;

type RichRuleValue = RuleValue | Date;

export interface Rule<Field extends string = string> {
  field: Field;
  operator: RuleOperator;
  value: RuleValue | RuleValue[];
}

export interface RuleGroup<Field extends string = string> {
  condition: "AND" | "OR";
  rules: (Rule<Field> | RuleGroup<Field>)[];
}

export function isRuleGroup<Field extends string = string>(
  a: Rule<Field> | RuleGroup<Field>
): a is RuleGroup<Field> {
  return "condition" in a;
}

function parseValue(value: RuleValue): RichRuleValue {
  if (typeof value === "string") {
    if (value.startsWith("$now")) {
      const date = moment.utc();
      const match = /\$now(\((?:(?:y|M|d|h|m|s):(?:-?\d+),?)+\))?/.exec(value);
      if (match && match[1]) {
        for (const modifier of match[1].matchAll(/(y|M|d|h|m|s):(-?\d+)/g)) {
          date.add(modifier[2], modifier[1] as DurationInputArg2);
        }
      }
      return date.toDate();
    }
    return value;
  } else {
    return value;
  }
}

export function buildRuleQuery<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  ruleGroup?: RuleGroup<Field>
): SelectQueryBuilder<Entity> {
  const params: Record<string, unknown> = {};
  let paramNo = 0;

  function parseRule(rule: Rule<Field>) {
    return (qb: WhereExpressionBuilder): void => {
      const values = Array.isArray(rule.value) ? rule.value : [rule.value];
      const parsedValues = values.map(parseValue);

      const [where, ruleParams] = operators[rule.operator](parsedValues);

      // Horrible code to make sure param names are unique
      const suffix = "_" + paramNo;
      for (const paramKey in ruleParams) {
        params[paramKey + suffix] =
          ruleParams[paramKey as keyof typeof ruleParams];
      }
      const namedWhere = where.replace(/:((\.\.\.)?[a-z])/g, `:$1${suffix}`);

      qb.where(`item.${rule.field} ${namedWhere}`);

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

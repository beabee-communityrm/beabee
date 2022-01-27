import moment, { DurationInputArg2 } from "moment";
import {
  Brackets,
  createQueryBuilder,
  SelectQueryBuilder,
  WhereExpressionBuilder
} from "typeorm";

import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";
import MemberPermission from "@models/MemberPermission";

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

const memberFields = [
  "id",
  "firstname",
  "lastname",
  "email",
  "joined",
  "lastSeen",
  "contributionType",
  "contributionMonthlyAmount",
  "contributionPeriod"
] as const;

const profileFields = ["deliveryOptIn", "tags", "newsletterStatus"] as const;

const complexFields = [
  "activeMembership",
  "activePermission",
  "membershipExpires"
] as const;

type RuleId =
  | typeof memberFields[number]
  | typeof profileFields[number]
  | typeof complexFields[number];
type RuleValue = string | number | boolean;
type RichRuleValue = RuleValue | Date;

export interface Rule {
  id: RuleId;
  field: RuleId;
  type: "string" | "integer" | "boolean" | "double";
  operator: keyof typeof operators;
  value: RuleValue | RuleValue[];
}

export interface RuleGroup {
  condition: "AND" | "OR";
  rules: (Rule | RuleGroup)[];
}

function isRuleGroup(a: Rule | RuleGroup): a is RuleGroup {
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

export function buildRuleQuery(
  qb: SelectQueryBuilder<Member>,
  ruleGroup: RuleGroup
) {
  const params: Record<string, unknown> = {};
  let paramNo = 0;

  function parseRule(rule: Rule) {
    return (qb: WhereExpressionBuilder): void => {
      const values = Array.isArray(rule.value) ? rule.value : [rule.value];
      const parsedValues = values.map(parseValue);

      // Special case where tags are in a JSON array
      if (rule.field === "tags") {
        rule.operator = "contains_jsonb";
      }

      const [where, ruleParams] = operators[rule.operator](parsedValues);

      // Horrible code to make sure param names are unique
      const suffix = "_" + paramNo;
      for (const paramKey in ruleParams) {
        params[paramKey + suffix] =
          ruleParams[paramKey as keyof typeof ruleParams];
      }
      const namedWhere = where.replace(/:((\.\.\.)?[a-z])/g, `:$1${suffix}`);

      if (rule.field === "membershipExpires") {
        const table = "mp" + suffix;
        const subQb = createQueryBuilder()
          .subQuery()
          .select(`${table}.memberId`)
          .from(MemberPermission, table)
          .where(
            `${table}.permission = 'member' AND ${table}.dateExpires ${namedWhere}`
          );
        qb.where("id IN " + subQb.getQuery());
      } else if (
        rule.field === "activeMembership" ||
        rule.field === "activePermission"
      ) {
        const table = "mp" + suffix;
        params["now" + suffix] = parseValue("$now");

        const permission =
          rule.field === "activeMembership" ? "member" : rule.value;

        const subQb = createQueryBuilder()
          .subQuery()
          .select(`${table}.memberId`)
          .from(MemberPermission, table)
          .where(
            `${table}.permission = '${permission}' AND ${table}.dateAdded <= :now${suffix}`
          )
          .andWhere(
            new Brackets((qb) => {
              qb.where(`${table}.dateExpires IS NULL`).orWhere(
                `${table}.dateExpires > :now${suffix}`
              );
            })
          );

        if (rule.field === "activePermission" || rule.value === true) {
          qb.where("id IN " + subQb.getQuery());
        } else {
          qb.where("id NOT IN " + subQb.getQuery());
        }
      } else if (memberFields.indexOf(rule.field as any) > -1) {
        qb.where(`m.${rule.field} ${namedWhere}`);
      } else if (profileFields.indexOf(rule.field as any) > -1) {
        const table = "profile" + suffix;
        const subQb = createQueryBuilder()
          .subQuery()
          .select(`${table}.memberId`)
          .from(MemberProfile, table)
          .where(`${table}.${rule.field} ${namedWhere}`);

        qb.where("id IN " + subQb.getQuery());
      }

      paramNo++;
    };
  }

  function parseRuleGroup(ruleGroup: RuleGroup) {
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

  parseRuleGroup(ruleGroup)(qb);

  qb.setParameters(params);
  return qb;
}

export function buildQuery(ruleGroup?: RuleGroup): SelectQueryBuilder<Member> {
  const qb = createQueryBuilder(Member, "m");
  qb.leftJoinAndSelect("m.permissions", "mp");
  qb.innerJoinAndSelect("m.profile", "profile");
  return ruleGroup ? buildRuleQuery(qb, ruleGroup) : qb;
}

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
  InvalidRule,
  parseDate,
  getMinDateUnit,
  RuleGroup
} from "@beabee/beabee-common";
import { BadRequestError } from "routing-controllers";
import {
  Brackets,
  EntityTarget,
  ObjectLiteral,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  UpdateResult,
  WhereExpressionBuilder
} from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { createQueryBuilder } from "@core/database";

import type {
  GetPaginatedRuleGroupRule,
  GetPaginatedRuleGroup
} from "@api/dto/BaseDto";

import {
  FilterHandler,
  FilterHandlers,
  RichRuleValue
} from "@type/filter-handlers";

import Contact from "@models/Contact";

// Operator definitions

const equalityOperatorsWhere = {
  equal: (field: string) => `${field} = :valueA`,
  not_equal: (field: string) => `${field} <> :valueA`
};

const nullableOperatorsWhere = {
  is_empty: (field: string) => `${field} IS NULL`,
  is_not_empty: (field: string) => `${field} IS NOT NULL`
};

const blobOperatorsWhere = {
  contains: (field: string) => `${field} ILIKE '%' || :valueA || '%'`,
  not_contains: (field: string) => `${field} NOT ILIKE '%' || :valueA || '%'`,
  is_empty: (field: string) => `${field} = ''`,
  is_not_empty: (field: string) => `${field} <> ''`
};

const numericOperatorsWhere = {
  ...equalityOperatorsWhere,
  ...nullableOperatorsWhere,
  less: (field: string) => `${field} < :valueA`,
  less_or_equal: (field: string) => `${field} <= :valueA`,
  greater: (field: string) => `${field} > :valueA`,
  greater_or_equal: (field: string) => `${field} >= :valueA`,
  between: (field: string) => `${field} BETWEEN :valueA AND :valueB`,
  not_between: (field: string) => `${field} NOT BETWEEN :valueA AND :valueB`
};

function withOperators<T extends FilterType>(
  type: T,
  operators: Record<
    keyof (typeof operatorsByType)[T] | "is_empty" | "is_not_empty",
    (field: string) => string
  >
) {
  return operators;
}

const operatorsWhereByType: Record<
  FilterType,
  Partial<Record<RuleOperator, (field: string) => string>>
> = {
  text: withOperators("text", {
    ...equalityOperatorsWhere,
    ...blobOperatorsWhere,
    begins_with: (field) => `${field} ILIKE :valueA || '%'`,
    not_begins_with: (field) => `${field} NOT ILIKE :valueA || '%'`,
    ends_with: (field) => `${field} ILIKE '%' || :valueA`,
    not_ends_with: (field) => `${field} NOT ILIKE '%' || :valueA`
  }),
  blob: withOperators("blob", blobOperatorsWhere),
  date: withOperators("date", numericOperatorsWhere),
  number: withOperators("number", numericOperatorsWhere),
  boolean: withOperators("boolean", {
    ...nullableOperatorsWhere,
    equal: equalityOperatorsWhere.equal
  }),
  array: withOperators("array", {
    contains: (field) => `${field} ? :valueA`,
    not_contains: (field) => `${field} ? :valueA = FALSE`,
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
};

// Generic field handlers

const simpleFilterHandler: FilterHandler = (qb, args) => {
  qb.where(args.convertToWhereClause(`${args.fieldPrefix}${args.field}`));
};

/**
 * Status is a virtual field that maps to starts and expires, this function
 * applies the correct filter for the status field value
 *
 * @param qb The query builder
 * @param args The rule arguments
 */
export const statusFilterHandler: FilterHandler = (qb, args) => {
  // TODO: handle other operators
  if (args.operator !== "equal") {
    throw new BadRequestError("Status field only supports equal operator");
  }

  switch (args.value[0]) {
    case ItemStatus.Draft:
      qb.where(`${args.fieldPrefix}starts IS NULL`);
      break;
    case ItemStatus.Scheduled:
      qb.where(`${args.fieldPrefix}starts > :now`);
      break;
    case ItemStatus.Open:
      qb.where(`${args.fieldPrefix}starts < :now`).andWhere(
        new Brackets((qb) => {
          qb.where(`${args.fieldPrefix}expires IS NULL`).orWhere(
            `${args.fieldPrefix}expires > :now`
          );
        })
      );
      break;
    case ItemStatus.Ended:
      qb.where(`${args.fieldPrefix}starts < :now`).andWhere(
        `${args.fieldPrefix}expires < :now`
      );
      break;
  }
};

// Rule parsing

const dateUnitSql = {
  y: "year",
  M: "month",
  d: "day",
  h: "hour",
  m: "minute",
  s: "second"
} as const;

function simpleField(field: string): string {
  return field;
}

function coalesceField(field: string): string {
  return `COALESCE(${field}, '')`;
}

/**
 * Takes a rule and returns a field mapping function and the values to compare
 *
 * - For text and blob fields, we add COALESE to the field if it's nullable so
 *   NULL values are treated as empty strings
 * - For date fields, we DATE_TRUNC the field to the day or more specific unit if
 *   provided and turn the value into a Date object
 * - For contact fields, it maps "me" to the contact id
 * - Otherwise, it returns the field and value as is
 * @param rule The rule to prepare
 * @param contact
 * @returns a field mapping function and the values to compare
 */
function prepareRule(
  rule: ValidatedRule<string>,
  contact: Contact | undefined
): [(field: string) => string, RichRuleValue[]] {
  switch (rule.type) {
    case "blob":
    case "text":
      // Make NULL an empty string for comparison
      return [rule.nullable ? coalesceField : simpleField, rule.value];

    case "date": {
      // Compare dates by at least day, but more specific if H/m/s are provided
      const values = rule.value.map((v) => parseDate(v));
      const minUnit = getMinDateUnit(["d", ...values.map(([_, unit]) => unit)]);
      return [
        (field) => `DATE_TRUNC('${dateUnitSql[minUnit]}', ${field})`,
        values.map(([date]) => date)
      ];
    }

    case "contact":
      if (!contact) {
        throw new Error("No contact provided to map contact field type");
      }
      // Map "me" to contact id
      return [
        simpleField,
        rule.value.map((v) => (v === "me" ? contact.id : v))
      ];

    default:
      return [simpleField, rule.value];
  }
}

/**
 * The query builder doesn't support having the same parameter names for
 * different parts of the query and subqueries, so we have to ensure each query
 * parameter has a unique name. We do this by appending a suffix "_<ruleNo>" to
 * the end of each parameter for each rule.
 *
 * @param ruleGroup The rule group
 * @param contact
 * @param filterHandlers
 * @param fieldPrefix
 * @returns
 */
export function convertRulesToWhereClause(
  ruleGroup: ValidatedRuleGroup<string>,
  contact: Contact | undefined,
  filterHandlers: FilterHandlers<string> | undefined,
  fieldPrefix: string
): [Brackets, Record<string, unknown>] {
  const params: Record<string, unknown> = {
    // Some queries need a current date parameter
    now: new Date()
  };
  let ruleNo = 0;

  function getFilterHandler(field: string): FilterHandler {
    let filterHandler = filterHandlers?.[field];
    // See if there is a catch all field handler for subfields
    if (!filterHandler && field.includes(".")) {
      const catchallField = field.split(".", 1)[0] + ".";
      filterHandler = filterHandlers?.[catchallField];
    }

    return filterHandler || simpleFilterHandler;
  }

  function parseRule(rule: ValidatedRule<string>) {
    return (qb: WhereExpressionBuilder): void => {
      const applyOperator = operatorsWhereByType[rule.type][rule.operator];
      if (!applyOperator) {
        // Shouln't be able to happen as rule has been validated
        throw new Error("Invalid ValidatedRule");
      }

      const paramSuffix = "_" + ruleNo;
      const [transformField, value] = prepareRule(rule, contact);

      // Add values as params
      params["valueA" + paramSuffix] = value[0];
      params["valueB" + paramSuffix] = value[1];

      // Add suffixes to parameters but avoid replacing casts e.g. ::boolean
      const addParamSuffix = (field: string) =>
        field.replace(/[^:]:[a-zA-Z]+/g, "$&" + paramSuffix);

      const newParams = getFilterHandler(rule.field)(qb, {
        fieldPrefix,
        field: rule.field,
        operator: rule.operator,
        type: rule.type,
        value,
        convertToWhereClause: (field) =>
          addParamSuffix(applyOperator(transformField(field))),
        addParamSuffix
      });

      if (newParams) {
        for (const [key, value] of Object.entries(newParams)) {
          params[key + paramSuffix] = value;
        }
      }

      ruleNo++;
    };
  }

  function parseRuleGroup(ruleGroup: ValidatedRuleGroup<string>) {
    return (qb: WhereExpressionBuilder): void => {
      if (ruleGroup.rules.length > 0) {
        qb.where(ruleGroup.condition === "AND" ? "TRUE" : "FALSE");
        const conditionFn =
          ruleGroup.condition === "AND" ? "andWhere" : "orWhere";
        for (const rule of ruleGroup.rules) {
          qb[conditionFn](
            new Brackets(
              isRuleGroup(rule) ? parseRuleGroup(rule) : parseRule(rule)
            )
          );
        }
      }
    };
  }

  const where = new Brackets(parseRuleGroup(ruleGroup));
  return [where, params];
}

/** @depreciated remove once SegmentService has been cleaned up */
export function buildSelectQuery<
  Entity extends ObjectLiteral,
  Field extends string
>(
  entity: EntityTarget<Entity>,
  ruleGroup: ValidatedRuleGroup<Field> | undefined,
  contact?: Contact,
  filterHandlers?: FilterHandlers<Field>
): SelectQueryBuilder<Entity> {
  const qb = createQueryBuilder(entity, "item");
  if (ruleGroup) {
    qb.where(
      ...convertRulesToWhereClause(ruleGroup, contact, filterHandlers, "item.")
    );
  }
  return qb;
}

export async function batchUpdate<
  Entity extends ObjectLiteral,
  Field extends string
>(
  entity: EntityTarget<Entity>,
  filters: Filters<Field>,
  ruleGroup: RuleGroup,
  updates: QueryDeepPartialEntity<Entity>,
  contact?: Contact,
  filterHandlers?: FilterHandlers<Field>,
  queryCallback?: (qb: UpdateQueryBuilder<Entity>, fieldPrefix: string) => void
): Promise<UpdateResult> {
  try {
    const validatedRuleGroup = validateRuleGroup(filters, ruleGroup);

    const qb = createQueryBuilder()
      .update(entity, updates)
      .where(
        ...convertRulesToWhereClause(
          validatedRuleGroup,
          contact,
          filterHandlers,
          ""
        )
      );

    queryCallback?.(qb, "");

    return await qb.execute();
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
  rules: (GetPaginatedRuleGroupRule | undefined | false)[]
): GetPaginatedRuleGroup {
  return {
    condition: "AND",
    rules: rules.filter((rule): rule is GetPaginatedRuleGroupRule => !!rule)
  };
}

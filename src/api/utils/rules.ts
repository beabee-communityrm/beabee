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
  equal: (field: string) => `${field} = :a`,
  not_equal: (field: string) => `${field} <> :a`
};

const nullableOperatorsWhere = {
  is_empty: (field: string) => `${field} IS NULL`,
  is_not_empty: (field: string) => `${field} IS NOT NULL`
};

const blobOperatorsWhere = {
  contains: (field: string) => `${field} ILIKE '%' || :a || '%'`,
  not_contains: (field: string) => `${field} NOT ILIKE '%' || :a || '%'`,
  is_empty: (field: string) => `${field} = ''`,
  is_not_empty: (field: string) => `${field} <> ''`
};

const numericOperatorsWhere = {
  ...equalityOperatorsWhere,
  ...nullableOperatorsWhere,
  less: (field: string) => `${field} < :a`,
  less_or_equal: (field: string) => `${field} <= :a`,
  greater: (field: string) => `${field} > :a`,
  greater_or_equal: (field: string) => `${field} >= :a`,
  between: (field: string) => `${field} BETWEEN :a AND :b`,
  not_between: (field: string) => `${field} NOT BETWEEN :a AND :b`
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
    begins_with: (field) => `${field} ILIKE :a || '%'`,
    not_begins_with: (field) => `${field} NOT ILIKE :a || '%'`,
    ends_with: (field) => `${field} ILIKE '%' || :a`,
    not_ends_with: (field) => `${field} NOT ILIKE '%' || :a`
  }),
  blob: withOperators("blob", blobOperatorsWhere),
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
};

// Generic field handlers

const simpleFilterHandler: FilterHandler = (qb, args) => {
  qb.where(args.whereFn(`${args.fieldPrefix}${args.field}`));
};

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

export function convertRulesToWhereClause(
  ruleGroup: ValidatedRuleGroup<string>,
  contact: Contact | undefined,
  filterHandlers: FilterHandlers<string> | undefined,
  fieldPrefix: string
): [Brackets, Record<string, unknown>] {
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
      const operatorFn = operatorsWhereByType[rule.type][rule.operator];
      if (!operatorFn) {
        // Shouln't be able to happen as rule has been validated
        throw new Error("Invalid ValidatedRule");
      }

      const suffix = "_" + ruleNo;
      const [fieldFn, value] = prepareRule(rule, contact);

      // Add values as params
      params["a" + suffix] = value[0];
      params["b" + suffix] = value[1];

      // Add suffixes to parameters but avoid replacing casts e.g. ::boolean
      const suffixFn = (field: string) =>
        field.replace(/[^:]:[a-zA-Z]+/g, "$&" + suffix);

      const filterHandler = getFilterHandler(rule.field);

      const extraParams = filterHandler(qb, {
        fieldPrefix,
        field: rule.field,
        operator: rule.operator,
        type: rule.type,
        value,
        whereFn: (field) => suffixFn(operatorFn(fieldFn(field))),
        suffixFn
      });

      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          params[key + suffix] = value;
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

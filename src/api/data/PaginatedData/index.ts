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
  createQueryBuilder,
  EntityTarget,
  getRepository,
  SelectQueryBuilder,
  WhereExpressionBuilder
} from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import Contact from "@models/Contact";

import {
  GetPaginatedQuery,
  GetPaginatedRuleGroupRule,
  Paginated,
  RichRuleValue,
  FieldHandlers,
  FieldHandler,
  GetPaginatedRuleGroup
} from "./interface";

// Operator definitions

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
  not_between: (field: string) => `${field} NOT BETWEEN :a AND :b`
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
  Partial<Record<RuleOperator, (field: string) => string>>
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
};

// Generic field handlers

const simpleFieldHandler: FieldHandler = (qb, args) => {
  qb.where(args.whereFn(`item.${args.field}`));
};

export const statusFieldHandler: FieldHandler = (qb, args) => {
  // TODO: handle other operators
  if (args.operator !== "equal") {
    throw new BadRequestError("Status field only supports equal operator");
  }

  switch (args.value[0]) {
    case ItemStatus.Draft:
      return qb.where(`item.starts IS NULL`);
    case ItemStatus.Scheduled:
      return qb.where(`item.starts > :now`);
    case ItemStatus.Open:
      return qb.where(`item.starts < :now`).andWhere(
        new Brackets((qb) => {
          qb.where("item.expires IS NULL").orWhere(`item.expires > :now`);
        })
      );
    case ItemStatus.Ended:
      return qb.where(`item.starts < :now`).andWhere(`item.expires < :now`);
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

function buildWhere<Field extends string>(
  ruleGroup: ValidatedRuleGroup<Field>,
  contact?: Contact,
  fieldHandlers?: FieldHandlers<Field>
): [Brackets, Record<string, unknown>] {
  /*
    The query builder doesn't support having the same parameter names for
    different parts of the query and subqueries, so we have to ensure each query
    parameter has a unique name. We do this by appending a suffix "_<ruleNo>" to
    the end of each parameter for each rule.
  */
  let ruleNo = 0;

  function parseRule(rule: ValidatedRule<Field>) {
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
      params["p" + suffix] = rule.field.substring(rule.field.indexOf(".") + 1);

      // Replace :[abp] but avoid replacing casts e.g. ::boolean
      const suffixFn = (field: string) =>
        field.replace(/[^:]:[abp]/g, "$&" + suffix);

      const fieldHandler = fieldHandlers?.[rule.field] || simpleFieldHandler;
      fieldHandler(qb, {
        ...rule,
        value,
        whereFn: (field) => suffixFn(operatorFn(fieldFn(field))),
        suffixFn
      });

      ruleNo++;
    };
  }

  function parseRuleGroup(ruleGroup: ValidatedRuleGroup<Field>) {
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

  const params: Record<string, unknown> = {
    // Some queries need a current date parameter
    now: new Date()
  };
  const where = new Brackets(parseRuleGroup(ruleGroup));
  return [where, params];
}

export function buildSelectQuery<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  ruleGroup: ValidatedRuleGroup<Field> | undefined,
  contact?: Contact,
  fieldHandlers?: FieldHandlers<Field>
): SelectQueryBuilder<Entity> {
  const qb = createQueryBuilder(entity, "item");
  if (ruleGroup) {
    qb.where(...buildWhere(ruleGroup, contact, fieldHandlers));
  }
  return qb;
}

export async function fetchPaginated<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  filters: Filters<Field>,
  query: GetPaginatedQuery,
  contact?: Contact,
  fieldHandlers?: FieldHandlers<Field>,
  queryCallback?: (qb: SelectQueryBuilder<Entity>) => void
): Promise<Paginated<Entity>> {
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  try {
    const ruleGroup = query.rules && validateRuleGroup(filters, query.rules);

    const qb = buildSelectQuery(entity, ruleGroup, contact, fieldHandlers)
      .offset(offset)
      .limit(limit);

    if (query.sort) {
      qb.orderBy({ [`item."${query.sort}"`]: query.order || "ASC" });
    }

    queryCallback?.(qb);

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

export async function batchUpdate<Entity, Field extends string>(
  entity: EntityTarget<Entity>,
  filters: Filters<Field>,
  ruleGroup: RuleGroup,
  updates: QueryDeepPartialEntity<Entity>,
  contact?: Contact,
  fieldHandlers?: FieldHandlers<Field>
): Promise<number> {
  try {
    const validatedRuleGroup = validateRuleGroup(filters, ruleGroup);

    const entityMetadata = getRepository(entity).metadata;
    if (entityMetadata.hasMultiplePrimaryKeys) {
      throw new BadRequestError(
        "Unsupported table for batch update: multiple primary keys"
      );
    }

    const pkey =
      getRepository(entity).metadata.primaryColumns[0]
        .databaseNameWithoutPrefixes;

    const items = await createQueryBuilder(entity, "item")
      .select(pkey)
      .where(...buildWhere(validatedRuleGroup, contact, fieldHandlers))
      .getRawMany();

    const result = await createQueryBuilder()
      .update(entity, updates)
      .where(`${pkey} IN (:...ids)`, { ids: items.map((i) => i[pkey]) })
      .execute();

    return result.affected || -1;
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
    rules: rules.filter((rule) => !!rule) as GetPaginatedRuleGroupRule[]
  };
}

export * from "./interface";

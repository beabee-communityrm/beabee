import {
  CalloutResponseFilterName,
  calloutResponseFilters,
  Filters,
  getCalloutFilters,
  PaginatedQuery,
  RuleOperator
} from "@beabee/beabee-common";

import { createQueryBuilder } from "@core/database";

import { BaseGetCalloutResponseOptsDto } from "@api/dto/CalloutResponseDto";
import { BaseTransformer } from "@api/transformers/BaseTransformer";
import { mergeRules } from "@api/utils/rules";

import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseTag from "@models/CalloutResponseTag";

import { AuthInfo } from "@type/auth-info";
import { FilterHandler, FilterHandlers } from "@type/filter-handlers";

export abstract class BaseCalloutResponseTransformer<
  GetDto,
  GetOptsDto extends BaseGetCalloutResponseOptsDto
> extends BaseTransformer<
  CalloutResponse,
  GetDto,
  CalloutResponseFilterName,
  GetOptsDto
> {
  protected model = CalloutResponse;
  protected filters = calloutResponseFilters;
  protected filterHandlers = calloutResponseFilterHandlers;

  protected transformFilters(
    query: GetOptsDto & PaginatedQuery
  ): [
    Partial<Filters<CalloutResponseFilterName>>,
    FilterHandlers<CalloutResponseFilterName>
  ] {
    // If looking for responses for a particular callout then add answer filtering
    if (query.callout) {
      const answerFilters = getCalloutFilters(query.callout.formSchema);
      // All handled by the same field handler
      const answerFilterHandlers = Object.fromEntries(
        Object.keys(answerFilters).map((field) => [
          field,
          individualAnswerFilterHandler
        ])
      );

      return [answerFilters, answerFilterHandlers];
    } else {
      return [{}, {}];
    }
  }

  protected transformQuery<T extends GetOptsDto & PaginatedQuery>(
    query: T,
    auth: AuthInfo | undefined
  ): T {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        // Non admins can only see their own responses
        !auth?.roles.includes("admin") && {
          field: "contact",
          operator: "equal",
          value: ["me"]
        },
        // Only load responses for the given callout
        !!query.callout && {
          field: "calloutId",
          operator: "equal",
          value: [query.callout.id]
        }
      ])
    };
  }
}

// Arrays are actually {a: true, b: false} type objects in answers
const answerArrayOperators: Partial<
  Record<RuleOperator, (field: string) => string>
> = {
  contains: (field) => `(${field} -> :a)::boolean`,
  not_contains: (field) => `NOT (${field} -> :a)::boolean`,
  is_empty: (field) => `NOT jsonb_path_exists(${field}, '$.* ? (@ == true)')`,
  is_not_empty: (field) => `jsonb_path_exists(${field}, '$.* ? (@ == true)')`
};

const individualAnswerFilterHandler: FilterHandler = (qb, args) => {
  const answerField = `${args.fieldPrefix}answers -> :s -> :k`;

  if (args.type === "array") {
    const operatorFn = answerArrayOperators[args.operator];
    if (!operatorFn) {
      // Shouln't be able to happen as rule has been validated
      throw new Error("Invalid ValidatedRule");
    }
    qb.where(args.suffixFn(operatorFn(answerField)));
    // is_empty and is_not_empty need special treatment for JSONB values
  } else if (args.operator === "is_empty" || args.operator === "is_not_empty") {
    const operator = args.operator === "is_empty" ? "IN" : "NOT IN";
    qb.where(
      args.suffixFn(
        `COALESCE(${answerField}, 'null') ${operator} ('null', '""')`
      )
    );
  } else if (args.type === "number" || args.type === "boolean") {
    const cast = args.type === "number" ? "numeric" : "boolean";
    qb.where(args.whereFn(`(${answerField})::${cast}`));
  } else {
    // Extract as text instead of JSONB (note ->> instead of ->)
    qb.where(args.whereFn(`${args.fieldPrefix}answers -> :s ->> :k`));
  }

  const [_, slideId, answerKey] = args.field.split(".");
  return {
    s: slideId,
    k: answerKey
  };
};

const calloutResponseFilterHandlers: FilterHandlers<string> = {
  answers: (qb, args) => {
    qb.where(
      args.whereFn(`(
        SELECT string_agg(answer.value, '')
        FROM jsonb_each(${args.fieldPrefix}answers) AS slide, jsonb_each_text(slide.value) AS answer
      )`)
    );
  },
  tags: (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select("crt.responseId")
      .from(CalloutResponseTag, "crt");

    if (args.operator === "contains" || args.operator === "not_contains") {
      subQb.where(args.suffixFn("crt.tag = :a"));
    }

    const inOp =
      args.operator === "not_contains" || args.operator === "is_not_empty"
        ? "NOT IN"
        : "IN";

    qb.where(`${args.fieldPrefix}id ${inOp} ${subQb.getQuery()}`);
  }
};

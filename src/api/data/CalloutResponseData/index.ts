import {
  Paginated,
  calloutResponseFilters,
  FilterType,
  convertComponentsToFilters,
  RuleOperator
} from "@beabee/beabee-common";
import { NotFoundError } from "routing-controllers";
import { FindConditions, getRepository } from "typeorm";

import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import Contact from "@models/Contact";

import { convertCalloutToData } from "../CalloutData";
import { convertContactToData } from "../ContactData";
import { mergeRules, fetchPaginated, FieldHandler } from "../PaginatedData";

import {
  GetCalloutResponseWith,
  GetCalloutResponseData,
  GetCalloutResponsesQuery,
  GetCalloutResponseQuery
} from "./interface";

export function convertResponseToData(
  response: CalloutResponse,
  _with?: GetCalloutResponseWith[]
): GetCalloutResponseData {
  return {
    id: response.id,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    ...(_with?.includes(GetCalloutResponseWith.Answers) && {
      answers: response.answers
    }),
    ...(_with?.includes(GetCalloutResponseWith.Callout) && {
      callout: convertCalloutToData(response.callout)
    }),
    ...(_with?.includes(GetCalloutResponseWith.Contact) && {
      contact: response.contact && convertContactToData(response.contact)
    })
  };
}

export async function fetchCalloutResponse(
  where: FindConditions<CalloutResponse>,
  query: GetCalloutResponseQuery,
  contact: Contact
): Promise<GetCalloutResponseData | undefined> {
  const response = await getRepository(CalloutResponse).findOne({
    where: {
      ...where,
      // Non-admins can only see their own responses
      ...(!contact.hasRole("admin") && { contact })
    },
    relations: [
      ...(query.with?.includes(GetCalloutResponseWith.Callout)
        ? ["callout"]
        : []),
      ...(query.with?.includes(GetCalloutResponseWith.Contact)
        ? ["contact", "contact.roles"]
        : [])
    ]
  });

  return response && convertResponseToData(response, query.with);
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

function answerField(type: FilterType): string {
  switch (type) {
    case "number":
      return "(item.answers -> :p)::numeric";
    case "boolean":
      return "(item.answers -> :p)::boolean";
    default:
      return "item.answers ->> :p";
  }
}

const answersFieldHandler: FieldHandler = (qb, args) => {
  if (args.type === "array") {
    const operatorFn = answerArrayOperators[args.operator];
    if (!operatorFn) {
      // Shouln't be able to happen as rule has been validated
      throw new Error("Invalid ValidatedRule");
    }
    qb.where(args.suffixFn(operatorFn("item.answers -> :p")));
    // is_empty and is_not_empty need special treatment for JSONB values
  } else if (args.operator === "is_empty" || args.operator === "is_not_empty") {
    const operator = args.operator === "is_empty" ? "IN" : "NOT IN";
    qb.where(
      args.suffixFn(
        `COALESCE(item.answers -> :p, 'null') ${operator} ('null', '""')`
      )
    );
  } else {
    qb.where(args.whereFn(answerField(args.type)));
  }
};

export async function fetchPaginatedCalloutResponses(
  query: GetCalloutResponsesQuery,
  contact: Contact,
  calloutSlug?: string
): Promise<Paginated<GetCalloutResponseData>> {
  const scopedQuery = mergeRules(query, [
    // Non admins can only see their own responses
    !contact.hasRole("admin") && {
      field: "contact",
      operator: "equal",
      value: [contact.id]
    },
    // Only load responses for the given callout
    !!calloutSlug && {
      field: "callout",
      operator: "equal",
      value: [calloutSlug]
    }
  ]);

  // If looking for responses for a particular callout then add answer filtering
  let answerFilters, fieldHandlers;
  if (calloutSlug) {
    const callout = await getRepository(Callout).findOne(calloutSlug);
    if (!callout) {
      throw new NotFoundError();
    }

    answerFilters = convertComponentsToFilters(callout.formSchema.components);
    // All handled by the same field handler
    fieldHandlers = Object.fromEntries(
      Object.keys(answerFilters).map((field) => [field, answersFieldHandler])
    );
  }

  const results = await fetchPaginated(
    CalloutResponse,
    { ...calloutResponseFilters, ...answerFilters },
    scopedQuery,
    contact,
    fieldHandlers,
    (qb) => {
      if (query.with?.includes(GetCalloutResponseWith.Callout)) {
        qb.innerJoinAndSelect("item.callout", "callout");
      }
      if (query.with?.includes(GetCalloutResponseWith.Contact)) {
        qb.leftJoinAndSelect("item.contact", "contact");
        qb.leftJoinAndSelect("contact.roles", "roles");
      }
    }
  );

  return {
    ...results,
    items: results.items.map((item) => convertResponseToData(item, query.with))
  };
}

export * from "./interface";

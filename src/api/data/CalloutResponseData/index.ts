import {
  Paginated,
  calloutResponseFilters,
  CalloutResponseFilterName,
  FilterType,
  Filters,
  convertComponentsToFilters
} from "@beabee/beabee-common";
import { BadRequestError, NotFoundError } from "routing-controllers";
import { FindConditions, getRepository } from "typeorm";

import CalloutResponse from "@models/CalloutResponse";
import Contact from "@models/Contact";

import { convertCalloutToData } from "../CalloutData";
import { convertContactToData } from "../ContactData";
import {
  mergeRules,
  fetchPaginated,
  FieldHandlers,
  operatorsWhereByType,
  FieldHandler
} from "../PaginatedData";

import {
  GetCalloutResponseWith,
  GetCalloutResponseData,
  GetCalloutResponsesQuery,
  GetCalloutResponseQuery
} from "./interface";
import Callout from "@models/Callout";

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

function getAnswerValue(type: FilterType) {
  switch (type) {
    case "number":
      return "(item.answers -> :p)::numeric";
    case "boolean":
    case "array":
      return "(item.answers -> :p)::boolean";
    default:
      return "item.answers ->> :p";
  }
}

const answersFieldHandler: FieldHandler = (qb, args) => {
  if (!args.param) {
    throw new BadRequestError("Parameter required for answers field");
  }

  if (args.type === "custom") {
    throw new Error();
  }

  let where: string;

  // is_empty and is_not_empty need special treatment for JSONB values
  if (args.operator === "is_empty" || args.operator === "is_not_empty") {
    const operator = args.operator === "is_empty" ? "IN" : "NOT IN";
    where = `COALESCE(item.answers -> :p, 'null') ${operator} ('null', '""')`;
  } else {
    const operatorFn = operatorsWhereByType[args.type][args.operator];
    if (operatorFn) {
      where = operatorFn(getAnswerValue(args.type));
    } else {
      throw new BadRequestError("Invalid operator for type");
    }
  }

  qb.where(args.whereFn(where));
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
    // fieldHandlers = Object.fromEntries(
    //   Object.keys(answerFilters).map((field) => [field, answersFieldHandler])
    // );
    fieldHandlers = { answers: answersFieldHandler };
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

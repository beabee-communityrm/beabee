import {
  Paginated,
  calloutResponseFilters,
  CalloutResponseFilterName
} from "@beabee/beabee-common";
import { BadRequestError } from "routing-controllers";
import { FindConditions, getRepository } from "typeorm";

import CalloutResponse from "@models/CalloutResponse";
import Contact from "@models/Contact";

import { convertCalloutToData } from "../CalloutData";
import { convertContactToData } from "../ContactData";
import {
  mergeRules,
  fetchPaginated,
  FieldHandlers,
  operatorsWhereByType
} from "../PaginatedData";

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

const valueTypeToFilter = {
  string: ["text", "item.answers ->> :p"],
  boolean: ["boolean", "(item.answers -> :p)::boolean"],
  number: ["number", "(item.answers -> :p)::numeric"]
} as const;

const fieldHandlers: FieldHandlers<CalloutResponseFilterName> = {
  answers: (qb, args) => {
    if (!args.param) {
      throw new BadRequestError("Parameter required for answers field");
    }

    let where: string;

    // is_empty and is_not_empty need special treatment for JSONB values
    if (args.operator === "is_empty" || args.operator === "is_not_empty") {
      const word = args.operator === "is_empty" ? "IN" : "NOT IN";
      where = `COALESCE(item.answers -> :p, 'null') ${word} ('null', '""')`;
    } else {
      const valueType = typeof args.values[0] as
        | "string"
        | "boolean"
        | "number";
      const [filterType, blah] = valueTypeToFilter[valueType];
      const operatorFn = operatorsWhereByType[filterType][args.operator];
      if (operatorFn) {
        where = operatorFn(blah);
      } else {
        throw new BadRequestError("Invalid operator for type");
      }
    }

    qb.where(args.whereFn(where));
  }
};

export async function fetchPaginatedCalloutResponses(
  query: GetCalloutResponsesQuery,
  contact: Contact
): Promise<Paginated<GetCalloutResponseData>> {
  const scopedQuery = mergeRules(query, [
    // Non admins can only see their own responses
    !contact.hasRole("admin") && {
      field: "contact",
      operator: "equal",
      value: [contact.id]
    }
  ]);

  const results = await fetchPaginated(
    CalloutResponse,
    calloutResponseFilters,
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

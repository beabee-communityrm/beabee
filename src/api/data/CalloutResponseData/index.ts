import {
  Paginated,
  calloutResponseFilters,
  CalloutResponseFilterName
} from "@beabee/beabee-common";
import { BadRequestError } from "routing-controllers";
import { FindConditions, getRepository } from "typeorm";

import CalloutResponse from "@models/CalloutResponse";
import Contact from "@models/Contact";

import { convertContactToData } from "../ContactData";
import { mergeRules, fetchPaginated, FieldHandlers } from "../PaginatedData";

import {
  GetCalloutResponseWith,
  GetCalloutResponseData,
  GetCalloutResponsesQuery,
  GetCalloutResponseQuery
} from "./interface";
import { convertCalloutToData } from "../CalloutData";

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

const fieldHandlers: FieldHandlers<CalloutResponseFilterName> = {
  answers: (qb, args) => {
    if (!args.param) {
      throw new BadRequestError("Parameter required for answers field");
    }

    qb.where(args.whereFn("item.answers ->> :p"));
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

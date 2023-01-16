import { Paginated, calloutResponseFilters } from "@beabee/beabee-common";
import { FindConditions, getRepository } from "typeorm";

import CalloutResponse from "@models/CalloutResponse";
import Contact from "@models/Contact";

import { convertContactToData } from "../ContactData";
import { mergeRules, fetchPaginated } from "../PaginatedData";

import {
  GetCalloutResponseWith,
  GetCalloutResponseData,
  GetCalloutResponsesQuery,
  GetCalloutResponseQuery
} from "./interface";

export function convertResponseToData(
  response: WithRelationIds<CalloutResponse, "callout">,
  _with?: GetCalloutResponseWith[]
): GetCalloutResponseData {
  return {
    id: response.id,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    callout: response.callout,
    ...(_with?.includes(GetCalloutResponseWith.Answers) && {
      answers: response.answers
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
  const response = (await getRepository(CalloutResponse).findOne({
    where: {
      ...where,
      // Non-admins can only see their own responses
      ...(!contact.hasRole("admin") && { contact })
    },
    relations: query.with?.includes(GetCalloutResponseWith.Contact)
      ? ["contact", "contact.roles"]
      : [],
    loadRelationIds: { relations: ["callout"] }
  })) as WithRelationIds<CalloutResponse, "callout"> | undefined;

  return response && convertResponseToData(response, query.with);
}

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

  const results = (await fetchPaginated(
    CalloutResponse,
    calloutResponseFilters,
    scopedQuery,
    contact,
    undefined,
    (qb) => {
      qb.loadAllRelationIds({ relations: ["callout"] });
      if (query.with?.includes(GetCalloutResponseWith.Contact)) {
        qb.leftJoinAndSelect("item.contact", "contact");
        qb.leftJoinAndSelect("contact.roles", "roles");
      }
    }
  )) as unknown as Paginated<WithRelationIds<CalloutResponse, "callout">>;

  return {
    ...results,
    items: results.items.map((item) => convertResponseToData(item, query.with))
  };
}

export * from "./interface";

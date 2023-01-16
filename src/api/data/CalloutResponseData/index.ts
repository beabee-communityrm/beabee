import { Paginated, calloutResponseFilters } from "@beabee/beabee-common";

import CalloutResponse from "@models/CalloutResponse";
import Contact from "@models/Contact";

import { convertContactToData } from "../ContactData";
import { mergeRules, fetchPaginated } from "../PaginatedData";

import {
  GetCalloutResponseWith,
  GetCalloutResponseData,
  GetCalloutResponsesQuery
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
    ...(_with?.includes(GetCalloutResponseWith.Contact) && {
      contact: response.contact && convertContactToData(response.contact)
    })
  };
}

export async function fetchPaginatedCalloutResponses(
  slug: string,
  query: GetCalloutResponsesQuery,
  contact: Contact
): Promise<Paginated<GetCalloutResponseData>> {
  const scopedQuery = mergeRules(query, [
    { field: "callout", operator: "equal", value: [slug] },
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
    undefined,
    (qb) => {
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

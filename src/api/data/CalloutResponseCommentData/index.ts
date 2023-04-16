import { Filters, Paginated } from "@beabee/beabee-common";
import CalloutResponseComment from "@models/CalloutResponseComment";
import { convertContactToData, loadUserRoles } from "../ContactData";
import { fetchPaginated } from "../PaginatedData";
import {
  GetCalloutResponseCommentData,
  GetCalloutResponseCommentsQuery
} from "./interface";

export function convertCommentToData(
  comment: CalloutResponseComment
): GetCalloutResponseCommentData {
  const commentData = {
    id: comment.id,
    contact: convertContactToData(comment.contact),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    responseId: comment.responseId,
    text: comment.text
  };

  return commentData;
}

const commentFilters: Filters = {
  responseId: {
    type: "text"
  },
  contact: {
    type: "contact"
  },
  createdAt: {
    type: "date"
  },
  updatedAt: {
    type: "date"
  },
  text: {
    type: "text"
  }
};

export async function fetchPaginatedCalloutResponseComments(
  query: GetCalloutResponseCommentsQuery
): Promise<Paginated<GetCalloutResponseCommentData>> {
  const results = await fetchPaginated(
    CalloutResponseComment,
    commentFilters,
    query,
    undefined,
    undefined,
    (qb, fieldPrefix) =>
      qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact")
  );

  // Load contact roles after to ensure offset/limit work
  await loadUserRoles(results.items.map((i) => i.contact));

  return {
    ...results,
    items: results.items.map((comment) => convertCommentToData(comment))
  };
}

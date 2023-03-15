import { Paginated } from "@beabee/beabee-common";
import CalloutResponseComment from "@models/CalloutResponseComment";
import { fetchPaginated } from "../PaginatedData";
import {
  GetCalloutResponseCommentData,
  GetCalloutResponseCommentsQuery
} from "./interface";

export function convertCommentToData(
  comment: CalloutResponseComment
): GetCalloutResponseCommentData {
  return {
    id: comment.id,
    contact: comment.contact,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    responseId: comment.response.id,
    text: comment.text
  };
}

export async function fetchPaginatedCalloutResponseComments(
  query: GetCalloutResponseCommentsQuery
): Promise<Paginated<GetCalloutResponseCommentData>> {
  const results = await fetchPaginated(CalloutResponseComment, {}, query);
  return {
    ...results,
    items: results.items.map(convertCommentToData)
  };
}

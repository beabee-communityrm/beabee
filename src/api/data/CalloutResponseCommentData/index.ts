import { Paginated } from "@beabee/beabee-common";
import CalloutResponseComment from "@models/CalloutResponseComment";
import { fetchPaginated } from "../PaginatedData";
import {
  GetCalloutResponseCommentData,
  GetCalloutResponseCommentsQuery
} from "./interface";

export function convertCommentToData(
  comment: CalloutResponseComment,
  responseId?: string
): GetCalloutResponseCommentData {
  const commentData = {
    id: comment.id,
    contact: comment.contact,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    responseId: "",
    text: comment.text
  };

  if (comment.response) commentData.responseId = comment.response.id;
  else if (responseId) commentData.responseId = responseId;

  return commentData;
}

export async function fetchPaginatedCalloutResponseComments(
  query: GetCalloutResponseCommentsQuery
): Promise<Paginated<GetCalloutResponseCommentData>> {
  const results = await fetchPaginated(CalloutResponseComment, {}, query);
  return {
    ...results,
    items: results.items.map((comment) => convertCommentToData(comment))
  };
}

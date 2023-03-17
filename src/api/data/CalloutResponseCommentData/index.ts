import { Filters, Paginated } from "@beabee/beabee-common";
import CalloutResponseComment from "@models/CalloutResponseComment";
import { SelectQueryBuilder } from "typeorm";
import { convertContactToData } from "../ContactData";
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

const commentFilter: Filters = {
  responseId: {
    type: "text"
  }
};

const queryCallback: (
  qb: SelectQueryBuilder<CalloutResponseComment>,
  fieldPrefix: string
) => void = function (
  qb: SelectQueryBuilder<CalloutResponseComment>,
  fieldPrefix: string
): void {
  qb.leftJoinAndSelect(fieldPrefix + "contact", "contact").leftJoinAndSelect(
    "contact.roles",
    "roles"
  );
};

export async function fetchPaginatedCalloutResponseComments(
  query: GetCalloutResponseCommentsQuery
): Promise<Paginated<GetCalloutResponseCommentData>> {
  const results = await fetchPaginated(
    CalloutResponseComment,
    commentFilter,
    query,
    undefined,
    undefined,
    queryCallback
  );
  return {
    ...results,
    items: results.items.map((comment) => convertCommentToData(comment))
  };
}

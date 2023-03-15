import CalloutResponseComment from "@models/CalloutResponseComment";
import { GetCalloutResponseCommentData } from "./interface";

export function convertCommentToData(
  comment: CalloutResponseComment
): GetCalloutResponseCommentData {
  return {
    id: comment.id,
    contact: comment.contact,
    createdAt: comment.createdAt,
    responseId: comment.response.id,
    text: comment.text
  };
}

import CalloutResponseComment from "@models/CalloutResponseComment";
import { GetCalloutResponseCommentData } from "./interface";

export function convertCommentToData(
  comment: CalloutResponseComment
): GetCalloutResponseCommentData {
  return {
    id: comment.id,
    contact: comment.contact,
    createdAt: comment.createdAt,
    calloutResponseId: comment.calloutResponse.id,
    text: comment.text
  };
}

import Contact from "@models/Contact";
import { IsIn, IsString } from "class-validator";
import { GetPaginatedQuery } from "../PaginatedData";

export interface CalloutResponseCommentData {
  responseId: string;
  text: string;
}

export interface GetCalloutResponseCommentData
  extends CalloutResponseCommentData {
  contact: Contact;
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateCalloutResponseCommentData
  implements CalloutResponseCommentData
{
  @IsString()
  responseId!: string;

  @IsString()
  text!: string;
}

export const responseSortFields = ["createdAt", "updatedAt"] as const;

export class GetCalloutResponseCommentsQuery extends GetPaginatedQuery {
  @IsIn(responseSortFields)
  sort?: string;
}

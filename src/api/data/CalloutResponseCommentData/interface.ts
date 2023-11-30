import Contact from "@models/Contact";
import { IsIn, IsObject, IsString } from "class-validator";
import { GetContactData } from "@type/get-contact-data";
import { GetPaginatedQuery } from "../PaginatedData";

export interface UpdateCalloutResponseComment {
  text: string;
}

export interface CalloutResponseCommentData
  extends UpdateCalloutResponseComment {
  responseId: string;
}

export interface CreateCalloutResponseCommentData
  extends CalloutResponseCommentData {
  contact: Contact;
}

export interface GetCalloutResponseCommentData
  extends CalloutResponseCommentData {
  contact: GetContactData;
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateCalloutResponseCommentData
  implements CreateCalloutResponseCommentData
{
  @IsString()
  responseId!: string;

  @IsString()
  text!: string;

  @IsObject()
  contact!: Contact;
}

export const responseSortFields = ["createdAt", "updatedAt"] as const;

export class GetCalloutResponseCommentsQuery extends GetPaginatedQuery {
  @IsIn(responseSortFields)
  declare sort?: string;
}

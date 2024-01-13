import { IsIn, IsString } from "class-validator";
import { GetContactData } from "@type/get-contact-data";
import { GetPaginatedQuery } from "../PaginatedData";

export interface UpdateCalloutResponseComment {
  text: string;
}

export interface CreateCalloutResponseCommentData
  extends UpdateCalloutResponseComment {
  responseId: string;
}

export interface GetCalloutResponseCommentData
  extends CreateCalloutResponseCommentData {
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
}

export const responseSortFields = ["createdAt", "updatedAt"] as const;

export class GetCalloutResponseCommentsQuery extends GetPaginatedQuery {
  @IsIn(responseSortFields)
  sort?: string;
}

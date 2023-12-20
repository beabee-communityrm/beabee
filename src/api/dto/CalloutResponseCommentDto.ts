import { IsIn, IsString } from "class-validator";

import { GetPaginatedQuery } from "@api/data/PaginatedData";

import { GetContactData } from "@type/get-contact-data";

interface UpdateCalloutResponseComment {
  text: string;
}

interface CalloutResponseCommentData extends UpdateCalloutResponseComment {
  responseId: string;
}

export interface GetCalloutResponseCommentDto
  extends CalloutResponseCommentData {
  contact: GetContactData;
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateCalloutResponseCommentDto {
  @IsString()
  responseId!: string;

  @IsString()
  text!: string;
}

export const responseSortFields = ["createdAt", "updatedAt"] as const;

export class QueryCalloutResponseCommentsDto extends GetPaginatedQuery {
  @IsIn(responseSortFields)
  sort?: string;
}

import { IsIn, IsString } from "class-validator";

import { GetPaginatedQuery } from "@api/data/PaginatedData/interface";
import { GetContactDto } from "@api/dto/ContactDto";

interface UpdateCalloutResponseComment {
  text: string;
}

interface CalloutResponseCommentData extends UpdateCalloutResponseComment {
  responseId: string;
}

export interface GetCalloutResponseCommentDto
  extends CalloutResponseCommentData {
  contact: GetContactDto;
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

export class ListCalloutResponseCommentsDto extends GetPaginatedQuery {
  @IsIn(["createdAt", "updatedAt"])
  sort?: string;
}

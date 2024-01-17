import { IsIn, IsString } from "class-validator";

import { GetPaginatedQuery } from "@api/dto/BaseDto";
import { GetContactDto } from "@api/dto/ContactDto";

export class CreateCalloutResponseCommentDto {
  @IsString()
  responseId!: string;

  @IsString()
  text!: string;
}

export interface GetCalloutResponseCommentDto
  extends CreateCalloutResponseCommentDto {
  contact: GetContactDto;
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ListCalloutResponseCommentsDto extends GetPaginatedQuery {
  @IsIn(["createdAt", "updatedAt"])
  sort?: string;
}

import { IsDate, IsIn, IsString, ValidateNested } from "class-validator";

import { GetPaginatedQuery } from "@api/dto/BaseDto";
import { GetContactDto } from "@api/dto/ContactDto";

export class CreateCalloutResponseCommentDto {
  @IsString()
  responseId!: string;

  @IsString()
  text!: string;
}

export class GetCalloutResponseCommentDto extends CreateCalloutResponseCommentDto {
  @IsString()
  id!: string;

  @ValidateNested()
  contact!: GetContactDto;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;
}

export class ListCalloutResponseCommentsDto extends GetPaginatedQuery {
  @IsIn(["createdAt", "updatedAt"])
  sort?: string;
}

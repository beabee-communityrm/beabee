import { Type } from "class-transformer";
import { IsDate, IsIn, IsString, ValidateNested } from "class-validator";

import { GetPaginatedQuery } from "@api/dto/BaseDto";
import { GetContactDto } from "@api/dto/ContactDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";

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

export class GetCalloutResponseCommentListDto extends PaginatedDto<GetCalloutResponseCommentDto> {
  @ValidateNested({ each: true })
  @Type(() => GetCalloutResponseCommentDto)
  items!: GetCalloutResponseCommentDto[];
}

export class ListCalloutResponseCommentsDto extends GetPaginatedQuery {
  @IsIn(["createdAt", "updatedAt"])
  sort?: string;
}

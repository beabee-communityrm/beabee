import { IsIn, IsString } from "class-validator";

import { GetPaginatedQuery } from "#api/dto/BaseDto";

export class GetCalloutTagDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;
}

export class CreateCalloutTagDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;
}

export class ListCalloutTagsDto extends GetPaginatedQuery {
  @IsIn(["id", "name"])
  sort?: string;
}

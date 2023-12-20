import { GetPaginatedQuery } from "@api/data/PaginatedData";
import { IsIn, IsString } from "class-validator";

export interface GetCalloutTagDto {
  id: string;
  name: string;
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

import { IsDate, IsIn, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

import { GetPaginatedQuery } from "@api/data/PaginatedData/interface";

import { GetContactDto } from "./ContactDto";

export class CreateApiKeyDto {
  @IsString()
  description!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expires!: Date | null;
}

export interface GetApiKeyDto extends CreateApiKeyDto {
  id: string;
  creator: GetContactDto;
  createdAt: Date;
}

export class ListApiKeysDto extends GetPaginatedQuery {
  @IsIn(["createdAt", "expires"])
  sort?: string;
}

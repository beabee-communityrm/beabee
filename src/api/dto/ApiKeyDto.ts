import { IsDate, IsIn, IsOptional, IsString } from "class-validator";
import { GetPaginatedQuery } from "../data/PaginatedData";
import { Type } from "class-transformer";
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

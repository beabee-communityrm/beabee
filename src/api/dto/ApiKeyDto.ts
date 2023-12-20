import { IsDate, IsIn, IsOptional, IsString } from "class-validator";
import { GetContactData } from "@type/get-contact-data";
import { GetPaginatedQuery } from "../data/PaginatedData";
import { Type } from "class-transformer";

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
  creator: GetContactData;
  createdAt: Date;
}

export class ListApiKeysDto extends GetPaginatedQuery {
  @IsIn(["createdAt", "expires"])
  sort?: string;
}

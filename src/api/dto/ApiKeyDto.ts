import { IsDate, IsIn, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

import { GetPaginatedQuery } from "@api/dto/BaseDto";
import { GetContactDto } from "@api/dto/ContactDto";

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

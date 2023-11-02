import { IsDate, IsIn, IsOptional, IsString } from "class-validator";
import { GetContactData } from "../ContactData";
import { GetPaginatedQuery } from "../PaginatedData";
import { Type } from "class-transformer";

export class CreateApiKeyData {
  @IsString()
  description!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expires!: Date | null;
}

export interface GetApiKeyData extends CreateApiKeyData {
  id: string;
  creator: GetContactData;
  createdAt: Date;
}

export class GetApiKeysQuery extends GetPaginatedQuery {
  @IsIn(["createdAt", "expires"])
  sort?: string;
}

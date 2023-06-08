import { IsString } from "class-validator";
import { GetContactData } from "../ContactData";
import { GetPaginatedQuery } from "../PaginatedData";

export class CreateApiKeyData {
  @IsString()
  description!: string;
}

export interface GetApiKeyData extends CreateApiKeyData {
  id: string;
  creator: GetContactData;
  createdAt: Date;
  secretHash: string;
}

export class GetApiKeysQuery extends GetPaginatedQuery {}

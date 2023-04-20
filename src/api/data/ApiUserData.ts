import { IsIn } from "class-validator";
import { GetPaginatedQuery } from "./PaginatedData";
import { GetUserRoleData } from "./UserData/interface";
import { GetContactData } from "./ContactData";
import { GetApiKeyData } from "./ApiKeyData";

const sortFields = ["joined"] as const;

export class GetApiUsersQuery extends GetPaginatedQuery {
  @IsIn(sortFields)
  sort?: string;
}

export interface CreateApiUserData {
  description?: string;
}

export interface GetApiUserData extends CreateApiUserData {
  id: string;
  joined: Date;
  roles: GetUserRoleData[];
  creator: GetContactData;
  apiKey: GetApiKeyData;
}

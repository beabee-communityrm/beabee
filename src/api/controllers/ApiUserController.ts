import { Filters, ItemStatus } from "@beabee/beabee-common";
import { CreateApiUserData, GetApiUsersQuery } from "@api/data/ApiUserData";
import { GetApiUserData } from "@api/data/ApiUserData/interface";
import { Paginated, fetchPaginated } from "@api/data/PaginatedData";
import ApiUsersService from "@core/services/ApiUsersService";
import UsersService from "@core/services/UsersService";
import { generateApiKey } from "@core/utils/auth";
import ApiUser from "@models/ApiUser";
import Contact from "@models/Contact";
import {
  JsonController,
  Authorized,
  Post,
  CurrentUser,
  Get,
  QueryParams,
  Body,
  OnUndefined,
  NotFoundError,
  Params,
  Delete
} from "routing-controllers";
import { UUIDParam } from "@api/data";
import { getRepository } from "typeorm";
import { log as mainLogger } from "@core/logging";
import UserRole from "@models/UserRole";

const log = mainLogger.child({ app: "ApiUser-Controller" });

@JsonController("/api-user")
@Authorized()
export class ApiUserController {
  @Get("/")
  async getApiUsers(
    @CurrentUser() contact: Contact,
    @QueryParams() query: GetApiUsersQuery
  ): Promise<Paginated<GetApiUserData>> {
    const results = await fetchPaginated(ApiUser, apiUserFilters, query);

    console.log(results);

    return {
      ...results,
      items: results.items
    };
  }

  @Post("/")
  async createApiUser(
    @Body() data: CreateApiUserData,
    @CurrentUser({ required: true }) creator: Contact
  ): Promise<{ token: string }> {
    const { id, secret, secretHash, token } = generateApiKey();
    const apiKey = {
      id: id,
      secretHash: secretHash,
      description: data.description
    };
    const apiUser = await ApiUsersService.createApiUser({
      roles: [],
      apiKey: apiKey,
      creator: creator
    });

    await UsersService.updateUserRole(apiUser, "admin");
    return { token };
  }

  @OnUndefined(204)
  @Delete("/:id")
  async deleteNotice(@Params() { id }: UUIDParam) {
    await getRepository(UserRole).delete({ user: { id } });
    const result = await getRepository(ApiUser).delete(id);
    log.info(result);
    if (!result.affected) throw new NotFoundError();
  }
}

export const apiUserFilters = {
  joined: {
    type: "date"
  }
} as const satisfies Filters;

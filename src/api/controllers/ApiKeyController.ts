import { Filters } from "@beabee/beabee-common";
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
import { getRepository } from "typeorm";

import {
  CreateApiKeyData,
  GetApiKeysQuery,
  GetApiKeyData,
  convertApiKeyToData
} from "@api/data/ApiKeyData";
import { Paginated, fetchPaginated } from "@api/data/PaginatedData";
import { generateApiKey } from "@core/utils/auth";
import ApiKey from "@models/ApiKey";
import Contact from "@models/Contact";

import { UUIDParam } from "@api/data";
import { loadContactRoles } from "@api/data/ContactData";

const apiUserFilters = {
  createdAt: {
    type: "date"
  }
} as const satisfies Filters;

@JsonController("/api-key")
@Authorized("admin")
export class ApiKeyController {
  @Get("/")
  async getApiKeys(
    @QueryParams() query: GetApiKeysQuery
  ): Promise<Paginated<GetApiKeyData>> {
    const results = await fetchPaginated(
      ApiKey,
      apiUserFilters,
      query,
      undefined,
      undefined,
      (qb, fieldPrefix) => {
        qb.leftJoinAndSelect(`${fieldPrefix}creator`, "creator");
      }
    );

    await loadContactRoles(results.items.map((i) => i.creator));

    return {
      ...results,
      items: results.items.map(convertApiKeyToData)
    };
  }

  @Post("/")
  async createApiKey(
    @Body() data: CreateApiKeyData,
    @CurrentUser({ required: true }) creator: Contact
  ): Promise<{ token: string }> {
    const { secretHash, token } = generateApiKey();

    await getRepository(ApiKey).save({
      secretHash,
      description: data.description || null,
      creator
    });

    return { token };
  }

  @OnUndefined(204)
  @Delete("/:id")
  async deleteApiKey(@Params() { id }: UUIDParam) {
    const result = await getRepository(ApiKey).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

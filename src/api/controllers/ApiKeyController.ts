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
  fetchPaginatedApiKeys
} from "@api/data/ApiKeyData";
import { Paginated } from "@api/data/PaginatedData";
import { generateApiKey } from "@core/utils/auth";
import ApiKey from "@models/ApiKey";
import Contact from "@models/Contact";

import { UUIDParam } from "@api/data";

@JsonController("/api-key")
@Authorized("admin")
export class ApiKeyController {
  @Get("/")
  async getApiKeys(
    @QueryParams() query: GetApiKeysQuery
  ): Promise<Paginated<GetApiKeyData>> {
    return await fetchPaginatedApiKeys(query);
  }

  @Post("/")
  async createApiKey(
    @Body() data: CreateApiKeyData,
    @CurrentUser({ required: true }) creator: Contact
  ): Promise<{ token: string }> {
    const { id, secretHash, token } = generateApiKey();

    await getRepository(ApiKey).save({
      id,
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

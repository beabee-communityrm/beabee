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
  Delete,
  Param
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
      creator,
      description: data.description,
      expires: data.expires
    });

    return { token };
  }

  @OnUndefined(204)
  @Delete("/:id")
  async deleteApiKey(@Param("id") id: string) {
    const result = await getRepository(ApiKey).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

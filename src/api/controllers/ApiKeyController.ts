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

import { getRepository } from "@core/database";
import { generateApiKey } from "@core/utils/auth";

import ApiKey from "@models/ApiKey";
import Contact from "@models/Contact";

import {
  CreateApiKeyDto,
  GetApiKeyDto,
  QueryApiKeysDto
} from "@api/dto/ApiKeyDto";
import { Paginated } from "@api/data/PaginatedData";
import ApiKeyTransformer from "@api/transformers/ApiKeyTransformer";

@JsonController("/api-key")
@Authorized("admin")
export class ApiKeyController {
  @Get("/")
  async getApiKeys(
    @CurrentUser({ required: true }) runner: Contact,
    @QueryParams() query: QueryApiKeysDto
  ): Promise<Paginated<GetApiKeyDto>> {
    return await ApiKeyTransformer.fetch(query, runner);
  }

  @Get("/:id")
  async getApiKey(
    @CurrentUser({ required: true }) runner: Contact,
    @Param("id") id: string
  ): Promise<GetApiKeyDto | undefined> {
    return await ApiKeyTransformer.fetchOneById(id, runner);
  }

  @Post("/")
  async createApiKey(
    @Body() data: CreateApiKeyDto,
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

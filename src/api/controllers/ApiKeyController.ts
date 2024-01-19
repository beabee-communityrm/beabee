import { Paginated } from "@beabee/beabee-common";
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

import { CurrentAuth } from "@api/decorators/CurrentAuth";
import {
  CreateApiKeyDto,
  GetApiKeyDto,
  ListApiKeysDto
} from "@api/dto/ApiKeyDto";
import ApiKeyTransformer from "@api/transformers/ApiKeyTransformer";

import { AuthInfo } from "@type/auth-info";

@JsonController("/api-key")
@Authorized("admin")
export class ApiKeyController {
  @Get("/")
  async getApiKeys(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @QueryParams() query: ListApiKeysDto
  ): Promise<Paginated<GetApiKeyDto>> {
    return await ApiKeyTransformer.fetch(auth, query);
  }

  @Get("/:id")
  async getApiKey(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Param("id") id: string
  ): Promise<GetApiKeyDto | undefined> {
    return await ApiKeyTransformer.fetchOneById(auth, id);
  }

  @Post("/")
  async createApiKey(
    @CurrentUser({ required: true }) creator: Contact,
    @Body() data: CreateApiKeyDto
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

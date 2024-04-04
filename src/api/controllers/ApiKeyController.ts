import { plainToInstance } from "class-transformer";
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
  ListApiKeysDto,
  NewApiKeyDto
} from "@api/dto/ApiKeyDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import ApiKeyTransformer from "@api/transformers/ApiKeyTransformer";

import { AuthInfo } from "@type/auth-info";

@JsonController("/api-key")
@Authorized("admin")
export class ApiKeyController {
  @Get("/")
  async getApiKeys(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @QueryParams() query: ListApiKeysDto
  ): Promise<PaginatedDto<GetApiKeyDto>> {
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
  @Authorized("superadmin")
  async createApiKey(
    @CurrentUser({ required: true }) creator: Contact,
    @Body() data: CreateApiKeyDto
  ): Promise<NewApiKeyDto> {
    const { id, secretHash, token } = generateApiKey();

    await getRepository(ApiKey).save({
      id,
      secretHash,
      creator,
      description: data.description,
      expires: data.expires
    });

    return plainToInstance(NewApiKeyDto, { token });
  }

  @OnUndefined(204)
  @Delete("/:id")
  async deleteApiKey(@Param("id") id: string): Promise<void> {
    const result = await getRepository(ApiKey).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

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

import {
  CreateApiKeyDto,
  GetApiKeyDto,
  ListApiKeysDto,
  NewApiKeyDto
} from "@api/dto/ApiKeyDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import ApiKeyTransformer from "@api/transformers/ApiKeyTransformer";

@JsonController("/api-key")
@Authorized("admin")
export class ApiKeyController {
  @Get("/")
  async getApiKeys(
    @CurrentUser({ required: true }) caller: Contact,
    @QueryParams() query: ListApiKeysDto
  ): Promise<PaginatedDto<GetApiKeyDto>> {
    return await ApiKeyTransformer.fetch(caller, query);
  }

  @Get("/:id")
  async getApiKey(
    @CurrentUser({ required: true }) caller: Contact,
    @Param("id") id: string
  ): Promise<GetApiKeyDto | undefined> {
    return await ApiKeyTransformer.fetchOneById(caller, id);
  }

  @Post("/")
  async createApiKey(
    @Body() data: CreateApiKeyDto,
    @CurrentUser({ required: true }) creator: Contact
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
  async deleteApiKey(@Param("id") id: string) {
    const result = await getRepository(ApiKey).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

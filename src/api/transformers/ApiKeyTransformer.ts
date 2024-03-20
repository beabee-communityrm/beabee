import {
  ApiKeyFilterName,
  RoleType,
  apiKeyFilters
} from "@beabee/beabee-common";
import { TransformPlainToInstance } from "class-transformer";
import { SelectQueryBuilder } from "typeorm";

import { GetApiKeyDto } from "#api/dto/ApiKeyDto";

import ApiKey from "#models/ApiKey";

import { BaseTransformer } from "./BaseTransformer";
import ContactTransformer, { loadContactRoles } from "./ContactTransformer";

class ApiKeyTransformer extends BaseTransformer<
  ApiKey,
  GetApiKeyDto,
  ApiKeyFilterName
> {
  protected model = ApiKey;
  protected filters = apiKeyFilters;

  protected allowedRoles: RoleType[] = ["admin"];

  @TransformPlainToInstance(GetApiKeyDto)
  convert(key: ApiKey): GetApiKeyDto {
    return {
      id: key.id,
      description: key.description,
      expires: key.expires,
      creator: ContactTransformer.convert(key.creator),
      createdAt: key.createdAt
    };
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<ApiKey>,
    fieldPrefix: string
  ): void {
    qb.leftJoinAndSelect(`${fieldPrefix}creator`, "creator");
  }

  protected modifyItems(keys: ApiKey[]): Promise<void> {
    return loadContactRoles(keys.map((key) => key.creator));
  }
}

export default new ApiKeyTransformer();

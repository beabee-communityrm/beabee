import { Filters, Paginated } from "@beabee/beabee-common";
import ApiKey from "@models/ApiKey";
import { GetApiKeyData, GetApiKeysQuery } from "./interface";
import { convertContactToData, loadContactRoles } from "../ContactData";
import { fetchPaginated } from "../PaginatedData";

export function convertApiKeyToData(apiKey: ApiKey): GetApiKeyData {
  return {
    id: apiKey.id,
    description: apiKey.description,
    expires: apiKey.expires,
    creator: convertContactToData(apiKey.creator),
    createdAt: apiKey.createdAt
  };
}

const apiUserFilters = {
  createdAt: {
    type: "date"
  }
} as const satisfies Filters;

export async function fetchPaginatedApiKeys(
  query: GetApiKeysQuery
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

export * from "./interface";

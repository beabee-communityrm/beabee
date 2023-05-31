import ApiKey from "@models/ApiKey";
import { GetApiKeyData } from "./interface";
import { convertContactToData } from "../ContactData";

export function convertApiKeyToData(apiKey: ApiKey): GetApiKeyData {
  return {
    id: apiKey.id,
    description: apiKey.description,
    creator: convertContactToData(apiKey.creator),
    createdAt: apiKey.createdAt,
    secretHash: apiKey.secretHash
  };
}

export * from "./interface";

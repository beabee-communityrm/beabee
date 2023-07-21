import ContactTag from "@models/ContactTag";
import { GetContactTagData } from "./interface";

export function convertTagToData(tag: ContactTag): GetContactTagData {
  return {
    id: tag.id,
    name: tag.name
  };
}

export * from "./interface";

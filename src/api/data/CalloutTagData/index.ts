import CalloutTag from "@models/CalloutTag";
import { GetCalloutTagData } from "./interface";

export function convertTagToData(tag: CalloutTag): GetCalloutTagData {
  return {
    id: tag.id,
    name: tag.name
  };
}

export * from "./interface";

import { ContentId } from "@type/content-id";
import { IsIn } from "class-validator";

export class ContentParams {
  @IsIn([
    "contacts",
    "email",
    "general",
    "join",
    "join/setup",
    "profile",
    "share"
  ] satisfies ContentId[])
  id!: ContentId;
}

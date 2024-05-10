import { ContentId, contentIds } from "@beabee/beabee-common";
import { IsIn } from "class-validator";

export class ContentParams {
  @IsIn(contentIds)
  id!: ContentId;
}

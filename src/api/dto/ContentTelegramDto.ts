import { IsString } from "class-validator";
import type { ContentTelegramData } from "@beabee/beabee-common";

export class GetContentTelegramDto implements ContentTelegramData {
  /** Markdown formatted welcome message */
  @IsString()
  welcomeMessageMd!: string;
}

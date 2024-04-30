import { IsString } from "class-validator";
import type { ContentTelegramData } from "@type/content-telegram-data";

export class GetContentTelegramDto implements ContentTelegramData {
  /** Markdown formatted welcome message */
  @IsString()
  welcomeMessageMd!: string;
}

import { Type } from "class-transformer";
import { IsBoolean, IsDate, IsOptional, IsString } from "class-validator";

import ItemStatus from "@models/ItemStatus";

interface NoticeData {
  name: string;
  expires?: Date;
  text: string;
  buttonText?: string;
  url?: string;
}

export const sortFields = [
  "createdAt",
  "updatedAt",
  "name",
  "expires"
] as const;

export interface GetNoticeData extends NoticeData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: ItemStatus;
}

export class CreateNoticeData implements NoticeData {
  @IsString()
  name!: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires?: Date;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  text!: string;

  @IsString()
  @IsOptional()
  buttonText?: string;

  @IsString()
  @IsOptional()
  url?: string;
}

import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString
} from "class-validator";

interface NoticeData {
  name: string;
  expires?: Date;
  enabled: boolean;
  text: string;
  buttonText: string;
  url?: string;
}

export enum NoticeStatus {
  Open = "open",
  Finished = "finished"
}

export class GetNoticesQuery {
  @IsEnum(NoticeStatus)
  @IsOptional()
  status?: NoticeStatus;
}

export interface GetNoticeData extends NoticeData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: NoticeStatus;
}

export class CreateNoticeData implements NoticeData {
  @IsString()
  name!: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires?: Date | undefined;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  text!: string;

  @IsString()
  buttonText!: string;

  @IsString()
  @IsOptional()
  url?: string | undefined;
}

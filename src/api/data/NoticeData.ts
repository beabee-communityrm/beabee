import { ItemStatus } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import { IsBoolean, IsDate, IsIn, IsOptional, IsString } from "class-validator";
import { GetPaginatedQuery } from "./PaginatedData";

interface NoticeData {
  name: string;
  starts?: Date;
  expires?: Date;
  text: string;
  buttonText?: string;
  url?: string;
}

const sortFields = ["createdAt", "updatedAt", "name", "expires"] as const;

export class GetNoticesQuery extends GetPaginatedQuery {
  @IsIn(sortFields)
  sort?: string;
}

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
  starts?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires?: Date;

  @IsString()
  text!: string;

  @IsString()
  @IsOptional()
  buttonText?: string;

  @IsString()
  @IsOptional()
  url?: string;
}

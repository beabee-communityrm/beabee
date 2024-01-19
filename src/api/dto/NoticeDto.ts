import { ItemStatus } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

import { GetPaginatedQuery } from "@api/dto/BaseDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";

const sortFields = ["createdAt", "updatedAt", "name", "expires"] as const;

export class ListNoticesDto extends GetPaginatedQuery {
  @IsIn(sortFields)
  sort?: string;
}

export class CreateNoticeDto {
  @IsString()
  name!: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  starts!: Date | null;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires!: Date | null;

  @IsString()
  text!: string;

  @IsString()
  @IsOptional()
  buttonText?: string;

  @IsString()
  @IsOptional()
  url?: string;
}

export class GetNoticeDto extends CreateNoticeDto {
  @IsString()
  id!: string;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  @IsEnum(ItemStatus)
  status!: ItemStatus;
}

export class GetNoticeListDto extends PaginatedDto<GetNoticeDto> {
  @ValidateNested({ each: true })
  @Type(() => GetNoticeDto)
  items!: GetNoticeDto[];
}

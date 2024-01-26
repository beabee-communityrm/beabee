import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

import { GetPaginatedQuery } from "@api/dto/BaseDto";
import { GetContactDto } from "@api/dto/ContactDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";

export class CreateApiKeyDto {
  @IsString()
  description!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expires!: Date | null;
}

export class NewApiKeyDto {
  @IsString()
  token!: string;
}

export class GetApiKeyDto extends CreateApiKeyDto {
  @IsString()
  id!: string;

  @ValidateNested()
  creator!: GetContactDto;

  @IsDate()
  createdAt!: Date;
}

export class ListApiKeysDto extends GetPaginatedQuery {
  @IsIn(["createdAt", "expires"])
  sort?: string;
}

export class GetApiKeysListDto extends PaginatedDto<GetApiKeyDto> {
  @ValidateNested({ each: true })
  @Type(() => GetApiKeyDto)
  items!: GetApiKeyDto[];
}

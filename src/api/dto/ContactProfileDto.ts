import { NewsletterStatus } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

import { AddressDto } from "@api/dto/AddressDto";

export class GetContactProfileDto {
  @IsString()
  telephone!: string;

  @IsString()
  twitter!: string;

  @IsString()
  preferredContact!: string;

  @IsBoolean()
  deliveryOptIn!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress!: AddressDto | null;

  @IsEnum(NewsletterStatus)
  newsletterStatus!: NewsletterStatus;

  @IsArray()
  @IsString({ each: true })
  newsletterGroups!: string[];

  @IsArray({ groups: ["admin"] })
  @IsString({ groups: ["admin"], each: true })
  tags?: string[];

  @IsString({ groups: ["admin"] })
  notes?: string;

  @IsString({ groups: ["admin"] })
  description?: string;
}

export class UpdateContactProfileDto implements Partial<GetContactProfileDto> {
  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  preferredContact?: string;

  @IsOptional()
  @IsString({ each: true })
  newsletterGroups?: string[];

  @IsOptional()
  @IsBoolean()
  deliveryOptIn?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress?: AddressDto;

  @IsOptional()
  @IsEnum(NewsletterStatus)
  newsletterStatus?: NewsletterStatus;

  // Admin only

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

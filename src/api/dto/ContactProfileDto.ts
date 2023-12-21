import { NewsletterStatus } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

import { GetAddressDto, UpdateAddressDto } from "@api/dto/AddressDto";

export interface GetContactProfileDto {
  telephone: string;
  twitter: string;
  preferredContact: string;
  deliveryOptIn: boolean;
  deliveryAddress: GetAddressDto | null;
  newsletterStatus: NewsletterStatus;
  newsletterGroups: string[];

  // Admin only
  tags?: string[];
  notes?: string;
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
  @Type(() => UpdateAddressDto)
  deliveryAddress?: UpdateAddressDto;

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

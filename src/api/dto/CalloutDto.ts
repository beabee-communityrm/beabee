import { CalloutFormSchema, ItemStatus } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  Equals,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

import { GetExportQuery, GetPaginatedQuery } from "@api/dto/BaseDto";
import { LinkDto } from "@api/dto/LinkDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import IsSlug from "@api/validators/IsSlug";
import IsUrl from "@api/validators/IsUrl";
import IsMapBounds from "@api/validators/IsMapBounds";
import IsLngLat from "@api/validators/IsLngLat";

import { CalloutMapSchema, CalloutResponseViewSchema } from "@models/Callout";

import { CalloutAccess } from "@enums/callout-access";

import { CalloutData } from "@type/callout-data";

export enum GetCalloutWith {
  Form = "form",
  ResponseViewSchema = "responseViewSchema",
  ResponseCount = "responseCount",
  HasAnswered = "hasAnswered"
}

export class GetCalloutOptsDto extends GetExportQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];

  // This property can only be set internally, not via query params
  @Equals(false)
  showHiddenForAll: boolean = false;
}

export class GetCalloutListDto extends PaginatedDto<GetCalloutDto> {
  @ValidateNested({ each: true })
  @Type(() => GetCalloutDto)
  items!: GetCalloutDto[];
}

export class ListCalloutsDto extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];

  @IsIn(["title", "starts", "expires"])
  sort?: string;

  // This property can only be set internally, not via query params
  @Equals(false)
  showHiddenForAll: boolean = false;
}

class SetCalloutMapSchemaDto implements CalloutMapSchema {
  @IsUrl()
  style!: string;

  @IsLngLat()
  @JSONSchema(() => ({
    type: "array",
    items: { type: "number", minimum: -180, maximum: 180 },
    minItems: 2,
    maxItems: 2
  }))
  center!: [number, number];

  @IsMapBounds()
  @JSONSchema(() => ({
    type: "array",
    items: {
      type: "array",
      items: { type: "number", minimum: -180, maximum: 180 },
      minItems: 2,
      maxItems: 2
    },
    minItems: 2,
    maxItems: 2
  }))
  bounds!: [[number, number], [number, number]];

  @IsNumber()
  @Min(0)
  @Max(20)
  minZoom!: number;

  @IsNumber()
  @Min(0)
  @Max(20)
  maxZoom!: number;

  @IsNumber()
  @Min(0)
  @Max(20)
  initialZoom!: number;

  @IsString()
  addressProp!: string;

  @IsString()
  addressPattern!: string;

  @IsString()
  addressPatternProp!: string;
}

class CalloutResponseViewSchemaDto implements CalloutResponseViewSchema {
  @IsArray()
  @IsString({ each: true })
  buckets!: string[];

  @IsString()
  titleProp!: string;

  @IsString()
  imageProp!: string;

  @IsString()
  imageFilter!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkDto)
  links!: LinkDto[];

  @IsBoolean()
  gallery!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SetCalloutMapSchemaDto)
  map!: SetCalloutMapSchemaDto | null;
}

abstract class BaseCalloutDto implements CalloutData {
  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsString()
  title!: string;

  @IsString()
  excerpt!: string;

  // TODO: Should be IsUrl but validation fails for draft callouts
  @IsString()
  image!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  starts!: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expires!: Date | null;

  @IsBoolean()
  allowUpdate!: boolean;

  @IsBoolean()
  allowMultiple!: boolean;

  @IsEnum(CalloutAccess)
  access!: CalloutAccess;

  @IsBoolean()
  hidden!: boolean;

  @IsOptional()
  @IsUrl()
  thanksRedirect?: string;

  @IsOptional()
  @IsString()
  shareTitle?: string;

  @IsOptional()
  @IsString()
  shareDescription?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CalloutResponseViewSchemaDto)
  responseViewSchema?: CalloutResponseViewSchemaDto | null;
}

export class CreateCalloutDto extends BaseCalloutDto {
  @IsString()
  intro!: string;

  @IsString()
  thanksTitle!: string;

  @IsString()
  thanksText!: string;

  // TODO: needs validation
  @IsObject()
  formSchema!: CalloutFormSchema;
}

export class GetCalloutDto extends BaseCalloutDto {
  @IsEnum(ItemStatus)
  status!: ItemStatus;

  @IsOptional()
  @IsString()
  intro?: string;

  @IsOptional()
  @IsString()
  thanksTitle?: string;

  @IsOptional()
  @IsString()
  thanksText?: string;

  @IsOptional()
  @IsBoolean()
  hasAnswered?: boolean;

  @IsOptional()
  @IsNumber()
  responseCount?: number;

  @IsOptional()
  @IsObject()
  formSchema?: CalloutFormSchema;
}

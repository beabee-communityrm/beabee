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

import { GetExportQuery, GetPaginatedQuery } from "@api/dto/BaseDto";
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

export interface GetCalloutDto extends CalloutData {
  slug: string;
  status: ItemStatus;
  // With "hasAnswered"
  hasAnswered?: boolean;
  // With "responseCount"
  responseCount?: number;
  // With "responseViewSchema"
  responseViewSchema?: CalloutResponseViewSchema | null;
}

class SetCalloutMapSchemaDto implements CalloutMapSchema {
  @IsUrl()
  style!: string;

  @IsLngLat()
  center!: [number, number];

  @IsMapBounds()
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

class SetCalloutResponseViewSchemaDto implements CalloutResponseViewSchema {
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
  // TODO: validate properly
  links!: { text: string; url: string }[];

  @IsBoolean()
  gallery!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SetCalloutMapSchemaDto)
  map!: SetCalloutMapSchemaDto | null;
}

export class CreateCalloutDto implements CalloutData {
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

  @IsString()
  intro!: string;

  @IsString()
  thanksTitle!: string;

  @IsString()
  thanksText!: string;

  @IsOptional()
  @IsUrl()
  thanksRedirect?: string;

  @IsOptional()
  @IsString()
  shareTitle?: string;

  @IsOptional()
  @IsString()
  shareDescription?: string;

  // TODO: needs validation
  @IsObject()
  formSchema!: CalloutFormSchema;

  @IsOptional()
  @ValidateNested()
  @Type(() => SetCalloutResponseViewSchemaDto)
  responseViewSchema!: SetCalloutResponseViewSchemaDto;

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
}

import { CalloutFormSchema, ItemStatus } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
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

import { GetExportQuery, GetPaginatedQuery } from "@api/data/PaginatedData";
import IsSlug from "@api/validators/IsSlug";
import IsUrl from "@api/validators/IsUrl";

import { CalloutMapSchema, CalloutResponseViewSchema } from "@models/Callout";
import IsMapBounds from "@api/validators/IsMapBounds";
import IsLngLat from "@api/validators/IsLngLat";

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
}

export class ListCalloutsDto extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];

  @IsIn(["title", "starts", "expires"])
  sort?: string;
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

class CalloutMapSchemaDto implements CalloutMapSchema {
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
  // TODO: validate properly
  links!: { text: string; url: string }[];

  @IsBoolean()
  gallery!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CalloutMapSchemaDto)
  map!: CalloutMapSchemaDto | null;
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
  @Type(() => CalloutResponseViewSchemaDto)
  responseViewSchema!: CalloutResponseViewSchemaDto;

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

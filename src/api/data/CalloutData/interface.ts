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

import { GetPaginatedQuery } from "@api/data/PaginatedData";
import IsSlug from "@api/validators/IsSlug";
import IsUrl from "@api/validators/IsUrl";

import {
  CalloutAccess,
  CalloutMapSchema,
  CalloutResponseViewSchema
} from "@models/Callout";
import IsMapBounds from "@api/validators/IsMapBounds";
import IsLngLat from "@api/validators/IsLngLat";

export enum GetCalloutWith {
  Form = "form",
  ResponseViewSchema = "responseViewSchema",
  ResponseCount = "responseCount",
  HasAnswered = "hasAnswered"
}

const sortFields = ["title", "starts", "expires"] as const;

export class GetCalloutsQuery extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];

  @IsIn(sortFields)
  sort?: string;
}

interface CalloutData {
  slug?: string;
  title: string;
  excerpt: string;
  image: string;
  starts: Date | null;
  expires: Date | null;
  allowUpdate: boolean;
  allowMultiple: boolean;
  access: CalloutAccess;
  hidden: boolean;

  // With "form"
  intro?: string;
  thanksTitle?: string;
  thanksText?: string;
  thanksRedirect?: string;
  shareTitle?: string;
  shareDescription?: string;
  formSchema?: CalloutFormSchema;
}

export interface GetCalloutData extends CalloutData {
  slug: string;
  status: ItemStatus;
  // With "hasAnswered"
  hasAnswered?: boolean;
  // With "responseCount"
  responseCount?: number;
  // With "responseViewSchema"
  responseViewSchema?: CalloutResponseViewSchema | null;
}

export class GetCalloutQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];
}

class CalloutMapSchemaData implements CalloutMapSchema {
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

  @IsOptional()
  @IsString()
  geocodeCountries?: string;
}

class CalloutResponseViewSchemaData implements CalloutResponseViewSchema {
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
  @Type(() => CalloutMapSchemaData)
  map!: CalloutMapSchemaData | null;
}

export class CreateCalloutData implements CalloutData {
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
  @Type(() => CalloutResponseViewSchemaData)
  responseViewSchema!: CalloutResponseViewSchemaData;

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

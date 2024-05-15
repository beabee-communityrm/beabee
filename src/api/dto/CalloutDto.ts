import { ItemStatus } from "@beabee/beabee-common";
import {
  Transform,
  TransformFnParams,
  Type,
  plainToInstance
} from "class-transformer";
import {
  Equals,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

import { GetExportQuery, GetPaginatedQuery } from "@api/dto/BaseDto";
import { GetCalloutFormDto, SetCalloutFormDto } from "@api/dto/CalloutFormDto";
import { CalloutVariantDto } from "@api/dto/CalloutVariantDto";
import { LinkDto } from "@api/dto/LinkDto";
import IsSlug from "@api/validators/IsSlug";
import IsUrl from "@api/validators/IsUrl";
import IsMapBounds from "@api/validators/IsMapBounds";
import IsLngLat from "@api/validators/IsLngLat";
import IsVariantsObject from "@api/validators/IsVariantsObject";

import { CalloutAccess } from "@enums/callout-access";
import { CalloutCaptcha } from "@enums/callout-captcha";
import { CalloutChannel } from "@enums/callout-channel";

import { CalloutData } from "@type/callout-data";
import { CalloutMapSchema } from "@type/callout-map-schema";
import { CalloutResponseViewSchema } from "@type/callout-response-view-schema";

export enum GetCalloutWith {
  Form = "form",
  HasAnswered = "hasAnswered",
  ResponseCount = "responseCount",
  ResponseViewSchema = "responseViewSchema",
  VariantNames = "variantNames",
  Variants = "variants"
}

export class GetCalloutOptsDto extends GetExportQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];

  @IsOptional()
  @IsString()
  variant?: string;

  // This property can only be set internally, not via query params
  @Equals(false)
  showHiddenForAll: boolean = false;
}

export class ListCalloutsDto extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];

  @IsOptional()
  @IsString()
  variant?: string;

  @IsIn(["title", "starts", "expires"])
  sort?: string;

  // This property can only be set internally, not via query params
  @Equals(false)
  showHiddenForAll: boolean = false;
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

  @IsOptional()
  @IsString()
  geocodeCountries?: string;
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
  @Type(() => CalloutMapSchemaDto)
  map!: CalloutMapSchemaDto | null;
}

abstract class BaseCalloutDto implements CalloutData {
  @IsOptional()
  @IsSlug()
  slug?: string;

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

  @IsEnum(CalloutCaptcha)
  captcha!: CalloutCaptcha;

  @IsBoolean()
  hidden!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CalloutResponseViewSchemaDto)
  responseViewSchema?: CalloutResponseViewSchemaDto | null;

  @IsOptional()
  @IsEnum(CalloutChannel, { each: true })
  channels!: CalloutChannel[] | null;
}

function transformVariants(
  params: TransformFnParams
): Record<string, CalloutVariantDto> {
  const ret: Record<string, CalloutVariantDto> = {};
  for (const variant in params.value) {
    ret[variant] = plainToInstance(CalloutVariantDto, params.value[variant]);
  }
  return ret;
}

export class CreateCalloutDto extends BaseCalloutDto {
  @ValidateNested()
  @Type(() => SetCalloutFormDto)
  formSchema!: SetCalloutFormDto;

  @IsVariantsObject()
  @Transform(transformVariants)
  variants!: Record<string, CalloutVariantDto>;
}

export class GetCalloutDto extends BaseCalloutDto {
  @IsString()
  id!: string;

  @IsEnum(ItemStatus)
  status!: ItemStatus;

  @IsString()
  title!: string;

  @IsString()
  excerpt!: string;

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
  @IsUrl()
  thanksRedirect?: string;

  @IsOptional()
  @IsString()
  shareTitle?: string;

  @IsOptional()
  @IsString()
  shareDescription?: string;

  @IsOptional()
  @IsBoolean()
  hasAnswered?: boolean;

  @IsOptional()
  @IsNumber()
  responseCount?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GetCalloutFormDto)
  formSchema?: GetCalloutFormDto;

  @IsOptional()
  @IsVariantsObject()
  @Transform(transformVariants)
  variants?: Record<string, CalloutVariantDto>;

  @IsOptional()
  @IsString({ each: true })
  variantNames?: string[];
}

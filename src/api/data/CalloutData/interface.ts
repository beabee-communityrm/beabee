import { ItemStatus } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString
} from "class-validator";

import { GetPaginatedQuery } from "@api/data/PaginatedData";
import IsSlug from "@api/validators/IsSlug";
import IsUrl from "@api/validators/IsUrl";

import { PollFormSchema, PollAccess } from "@models/Poll";
import { PollResponseAnswers } from "@models/PollResponse";

export enum GetCalloutWith {
  Form = "form",
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
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  starts: Date | null;
  expires: Date | null;
  allowUpdate: boolean;
  allowMultiple: boolean;
  access: PollAccess;
  hidden: boolean;

  // With "form"
  intro?: string;
  thanksTitle?: string;
  thanksText?: string;
  thanksRedirect?: string;
  shareTitle?: string;
  shareDescription?: string;
  formSchema?: PollFormSchema;
}

export interface GetCalloutData extends CalloutData {
  status: ItemStatus;
  // With "hasAnswered"
  hasAnswered?: boolean;
  // With "responseCount"
  responseCount?: number;
}

export class GetCalloutQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];
}

export class CreateCalloutData implements CalloutData {
  @IsString()
  slug!: string;

  @IsString()
  title!: string;

  @IsString()
  excerpt!: string;

  @IsUrl()
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

  @IsObject()
  formSchema!: PollFormSchema;

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

  @IsEnum(PollAccess)
  access!: PollAccess;

  @IsBoolean()
  hidden!: boolean;
}

export const responseSortFields = ["createdAt", "updatedAt"] as const;

export class GetCalloutResponsesQuery extends GetPaginatedQuery {
  @IsIn(responseSortFields)
  sort?: string;
}

export interface GetCalloutResponseData {
  member: string;
  answers: PollResponseAnswers;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateCalloutResponseData {
  @IsObject()
  answers!: PollResponseAnswers;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsEmail()
  guestEmail?: string;
}

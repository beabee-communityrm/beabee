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

import { CalloutFormSchema, CalloutAccess } from "@models/Callout";
import { CalloutResponseAnswers } from "@models/CalloutResponse";
import { GetContactData } from "../ContactData";

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
}

export class GetCalloutQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];
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

  @IsObject()
  formSchema!: CalloutFormSchema;

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

export enum GetCalloutResponseWith {
  Answers = "answers",
  Contact = "contact"
}

export class GetCalloutResponseQuery {
  @IsOptional()
  @IsEnum(GetCalloutResponseWith, { each: true })
  with?: GetCalloutResponseWith[];
}

export const responseSortFields = ["createdAt", "updatedAt"] as const;

export class GetCalloutResponsesQuery extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetCalloutResponseWith, { each: true })
  with?: GetCalloutResponseWith[];

  @IsIn(responseSortFields)
  sort?: string;
}

export interface GetCalloutResponseData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  answers?: CalloutResponseAnswers;
  contact?: GetContactData;
}

export class CreateCalloutResponseData {
  @IsObject()
  answers!: CalloutResponseAnswers;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsEmail()
  guestEmail?: string;
}

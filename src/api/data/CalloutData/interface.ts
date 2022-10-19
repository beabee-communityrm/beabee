import { GetPaginatedQuery } from "@api/utils/pagination";
import IsSlug from "@api/validators/IsSlug";
import IsUrl from "@api/validators/IsUrl";
import ItemStatus from "@models/ItemStatus";
import { PollFormSchema, PollAccess } from "@models/Poll";
import { PollResponseAnswers } from "@models/PollResponse";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString
} from "class-validator";

export enum GetCalloutWith {
  Form = "form",
  ResponseCount = "responseCount",
  HasAnswered = "hasAnswered"
}

export const sortFields = ["title", "starts", "expires"] as const;

export class GetCalloutsQuery extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];
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
  hasAnswered?: boolean;
  responseCount?: number;
}

export class GetCalloutQuery {
  @IsOptional()
  @IsEnum(GetCalloutWith, { each: true })
  with?: GetCalloutWith[];
}

export class UpdateCalloutData implements Omit<CalloutData, "slug"> {
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

export class CreateCalloutData
  extends UpdateCalloutData
  implements CalloutData
{
  @IsSlug()
  slug!: string;
}

export const responseSortFields = ["createdAt", "updatedAt"] as const;

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

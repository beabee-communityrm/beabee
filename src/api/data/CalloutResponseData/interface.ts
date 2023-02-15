import { CalloutResponseAnswers } from "@models/CalloutResponse";
import {
  IsOptional,
  IsEnum,
  IsString,
  IsIn,
  IsObject,
  IsEmail
} from "class-validator";
import { UUIDParam } from "..";
import { GetCalloutData } from "../CalloutData";
import { GetContactData } from "../ContactData";
import { GetPaginatedQuery } from "../PaginatedData";

export enum GetCalloutResponseWith {
  Answers = "answers",
  Callout = "callout",
  Contact = "contact"
}

export class GetCalloutResponseQuery {
  @IsOptional()
  @IsEnum(GetCalloutResponseWith, { each: true })
  with?: GetCalloutResponseWith[];
}

export class GetCalloutResponseParam extends UUIDParam {
  @IsString()
  slug!: string;
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
  bucket: string | null;
  answers?: CalloutResponseAnswers;
  callout?: GetCalloutData;
  contact?: GetContactData | null;
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

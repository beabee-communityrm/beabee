import { CalloutResponseAnswers } from "@models/CalloutResponse";
import { Type } from "class-transformer";
import {
  IsOptional,
  IsEnum,
  IsString,
  IsIn,
  IsObject,
  IsEmail,
  IsArray,
  IsUUID,
  Validate,
  ValidateNested,
  IsDefined
} from "class-validator";
import { UUIDParam } from "..";
import { GetCalloutData } from "../CalloutData";
import { GetCalloutTagData } from "../CalloutTagData";
import { GetContactData } from "../ContactData";
import { GetPaginatedQuery, GetPaginatedRuleGroup } from "../PaginatedData";

export enum GetCalloutResponseWith {
  Answers = "answers",
  Callout = "callout",
  Contact = "contact",
  Tags = "tags"
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
  tags?: GetCalloutTagData[];
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

  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

export class BatchUpdateCalloutResponseData {
  @IsDefined()
  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  rules?: GetPaginatedRuleGroup;

  @ValidateNested()
  @Type(() => CreateCalloutResponseData)
  updates!: CreateCalloutResponseData;
}

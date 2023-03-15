import { CalloutResponseAnswers } from "@models/CalloutResponse";
import { Type } from "class-transformer";
import {
  IsOptional,
  IsEnum,
  IsString,
  IsIn,
  IsObject,
  IsEmail,
  ValidateNested,
  IsDefined,
  IsUUID
} from "class-validator";
import { UUIDParam } from "..";
import { GetCalloutData } from "../CalloutData";
import { GetCalloutTagData } from "../CalloutTagData";
import { GetContactData } from "../ContactData";
import { GetPaginatedQuery, GetPaginatedRuleGroup } from "../PaginatedData";

export enum GetCalloutResponseWith {
  Answers = "answers",
  Assignee = "assignee",
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

export const responseSortFields = ["number", "createdAt", "updatedAt"] as const;

export class GetCalloutResponsesQuery extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetCalloutResponseWith, { each: true })
  with?: GetCalloutResponseWith[];

  @IsIn(responseSortFields)
  sort?: string;
}

export class ExportCalloutResponsesQuery {
  @IsOptional()
  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  rules?: GetPaginatedRuleGroup;
}

export interface GetCalloutResponseData {
  id: string;
  number: number;
  createdAt: Date;
  updatedAt: Date;
  bucket: string;
  answers?: CalloutResponseAnswers;
  callout?: GetCalloutData;
  contact?: GetContactData | null;
  tags?: GetCalloutTagData[];
  assignee?: GetContactData | null;
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

  @IsUUID()
  @IsOptional()
  assigneeId?: string;
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

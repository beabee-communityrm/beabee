import {
  CalloutResponseAnswerAddress,
  CalloutResponseAnswerFileUpload,
  CalloutResponseAnswers
} from "@beabee/beabee-common";
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
import { GetPaginatedQuery, GetPaginatedRuleGroup } from "../PaginatedData";
import { GetContactDto } from "@api/dto/ContactDto";
import { GetCalloutDto } from "@api/dto/CalloutDto";
import { GetCalloutResponseCommentDto } from "@api/dto/CalloutResponseCommentDto";
import { GetCalloutTagDto } from "@api/dto/CalloutTagDto";

export enum GetCalloutResponseWith {
  Answers = "answers",
  Assignee = "assignee",
  Callout = "callout",
  Contact = "contact",
  LatestComment = "latestComment",
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

export interface GetCalloutResponseData {
  id: string;
  number: number;
  createdAt: Date;
  updatedAt: Date;
  bucket: string;
  guestName: string | null;
  guestEmail: string | null;
  answers?: CalloutResponseAnswers;
  callout?: GetCalloutDto;
  contact?: GetContactDto | null;
  tags?: GetCalloutTagDto[];
  assignee?: GetContactDto | null;
  latestComment?: GetCalloutResponseCommentDto | null;
}

export interface GetCalloutResponseMapData {
  number: number;
  answers: CalloutResponseAnswers;
  title: string;
  photos: CalloutResponseAnswerFileUpload[];
  address?: CalloutResponseAnswerAddress;
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
  assigneeId?: string | null;
}

export class BatchUpdateCalloutResponseData {
  @IsDefined()
  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  rules!: GetPaginatedRuleGroup;

  @ValidateNested()
  @Type(() => CreateCalloutResponseData)
  updates!: CreateCalloutResponseData;
}

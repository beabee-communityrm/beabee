import {
  CalloutComponentSchema,
  CalloutResponseAnswerAddress,
  CalloutResponseAnswerFileUpload,
  CalloutResponseAnswers,
  PaginatedQuery
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
import {
  GetExportQuery,
  GetPaginatedQuery,
  GetPaginatedRuleGroup
} from "../data/PaginatedData";
import { GetContactDto } from "@api/dto/ContactDto";
import { GetCalloutDto } from "@api/dto/CalloutDto";
import { GetCalloutResponseCommentDto } from "@api/dto/CalloutResponseCommentDto";
import { GetCalloutTagDto } from "@api/dto/CalloutTagDto";

import Callout, { CalloutResponseViewSchema } from "@models/Callout";

export interface BaseGetCalloutResponseOptsDto {
  callout?: Callout;
}

export enum GetCalloutResponseWith {
  Answers = "answers",
  Assignee = "assignee",
  Callout = "callout",
  Contact = "contact",
  LatestComment = "latestComment",
  Tags = "tags"
}

export class GetCalloutResponseOptsDto {
  @IsOptional()
  @IsEnum(GetCalloutResponseWith, { each: true })
  with?: GetCalloutResponseWith[];
}

export class ListCalloutResponsesDto extends GetPaginatedQuery {
  @IsOptional()
  @IsEnum(GetCalloutResponseWith, { each: true })
  with?: GetCalloutResponseWith[];

  @IsIn(["number", "createdAt", "updatedAt"])
  sort?: string;
}

// TODO: this is a bit hacky
export interface GetCalloutResponseOptsDto
  extends BaseGetCalloutResponseOptsDto {}
export interface ListCalloutResponsesDto
  extends BaseGetCalloutResponseOptsDto {}

export interface GetCalloutResponseDto {
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

export class CreateCalloutResponseDto {
  // TODO: validate
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

  @IsUUID("4")
  @IsOptional()
  assigneeId?: string | null;
}

export class BatchUpdateCalloutResponseDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  rules!: GetPaginatedRuleGroup;

  @ValidateNested()
  @Type(() => CreateCalloutResponseDto)
  updates!: CreateCalloutResponseDto;
}

// Export types

export type ExportCalloutResponseDto = [
  createdAt: string,
  number: number,
  bucket: string,
  tags: string,
  assigneeEmail: string,
  firstname: string,
  lastname: string,
  fullname: string,
  email: string,
  isGuest: boolean,
  comments: string,
  ...answers: string[]
];

export interface ExportCalloutResponsesOptsDto
  extends GetExportQuery,
    BaseGetCalloutResponseOptsDto {
  callout: Callout;
  components: (CalloutComponentSchema & { slideId: string })[];
}

// Get callout response map types

export interface GetCalloutResponseMapDto {
  number: number;
  answers: CalloutResponseAnswers;
  title: string;
  photos: CalloutResponseAnswerFileUpload[];
  address?: CalloutResponseAnswerAddress;
}

export interface GetCalloutResponseMapOptsDto
  extends BaseGetCalloutResponseOptsDto {
  callout: Callout & { responseViewSchema: CalloutResponseViewSchema };
}

export type ListCalloutResponseMapDto = GetCalloutResponseMapOptsDto &
  PaginatedQuery;

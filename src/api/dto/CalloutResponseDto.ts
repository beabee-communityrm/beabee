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
  IsUUID,
  IsNumber,
  IsDate,
  Allow
} from "class-validator";

import {
  GetExportQuery,
  GetPaginatedQuery,
  GetPaginatedRuleGroup
} from "@api/dto/BaseDto";
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

export class GetCalloutResponseDto {
  @IsString()
  id!: string;

  @IsNumber()
  number!: number;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  @IsString()
  bucket!: string;

  @IsOptional()
  @IsString()
  guestName!: string | null;

  @IsOptional()
  @IsString()
  guestEmail!: string | null;

  @IsOptional()
  @IsObject()
  answers?: CalloutResponseAnswers;

  @IsOptional()
  @ValidateNested()
  callout?: GetCalloutDto;

  @IsOptional()
  @ValidateNested()
  contact?: GetContactDto | null;

  @IsOptional()
  @ValidateNested({ each: true })
  tags?: GetCalloutTagDto[];

  @IsOptional()
  @ValidateNested()
  assignee?: GetContactDto | null;

  @IsOptional()
  @ValidateNested()
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

export class BatchUpdateCalloutResponseResultDto {
  @IsNumber()
  affected!: number;
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

export class GetCalloutResponseMapDto {
  @IsNumber()
  number!: number;

  @IsObject()
  answers!: CalloutResponseAnswers;

  @IsString()
  title!: string;

  @Allow()
  photos!: CalloutResponseAnswerFileUpload[];

  @Allow()
  address?: CalloutResponseAnswerAddress;
}

export interface GetCalloutResponseMapOptsDto
  extends BaseGetCalloutResponseOptsDto {
  callout: Callout & { responseViewSchema: CalloutResponseViewSchema };
}

export type ListCalloutResponseMapDto = GetCalloutResponseMapOptsDto &
  PaginatedQuery;

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
import {
  GetPaginatedQuery,
  GetPaginatedRuleGroup
} from "../data/PaginatedData";
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

export interface GetCalloutResponseMapDto {
  number: number;
  answers: CalloutResponseAnswers;
  title: string;
  photos: CalloutResponseAnswerFileUpload[];
  address?: CalloutResponseAnswerAddress;
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

export class BatchUpdateCalloutResponseData {
  @IsDefined()
  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  rules!: GetPaginatedRuleGroup;

  @ValidateNested()
  @Type(() => CreateCalloutResponseDto)
  updates!: CreateCalloutResponseDto;
}

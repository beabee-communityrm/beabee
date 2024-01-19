import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Params,
  Patch,
  Post,
  QueryParams
} from "routing-controllers";

import { getRepository } from "@core/database";

import { CurrentAuth } from "@api/decorators/CurrentAuth";
import PartialBody from "@api/decorators/PartialBody";
import {
  CreateCalloutResponseCommentDto,
  GetCalloutResponseCommentDto,
  ListCalloutResponseCommentsDto
} from "@api/dto/CalloutResponseCommentDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import { UUIDParams } from "@api/params/UUIDParams";

import CalloutResponseCommentTransformer from "@api/transformers/CalloutResponseCommentTransformer";

import CalloutResponseComment from "@models/CalloutResponseComment";
import Contact from "@models/Contact";

import { AuthInfo } from "@type/auth-info";

@JsonController("/callout-response-comments")
@Authorized("admin")
export class CalloutResponseCommentController {
  @Post("/")
  async createCalloutReponseComment(
    @Body() data: CreateCalloutResponseCommentDto,
    @CurrentUser({ required: true }) contact: Contact
  ): Promise<GetCalloutResponseCommentDto> {
    const comment: CalloutResponseComment = await getRepository(
      CalloutResponseComment
    ).save({
      contact,
      text: data.text,
      response: { id: data.responseId }
    });
    return CalloutResponseCommentTransformer.convert(comment);
  }

  @Get("/")
  async getCalloutResponseComments(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @QueryParams() query: ListCalloutResponseCommentsDto
  ): Promise<PaginatedDto<GetCalloutResponseCommentDto>> {
    return await CalloutResponseCommentTransformer.fetch(auth, query);
  }

  @Get("/:id")
  async getCalloutResponseComment(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Params() { id }: UUIDParams
  ): Promise<GetCalloutResponseCommentDto | undefined> {
    return await CalloutResponseCommentTransformer.fetchOneById(auth, id);
  }

  @Patch("/:id")
  async updateCalloutResponseComment(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Params() { id }: UUIDParams,
    @PartialBody() data: CreateCalloutResponseCommentDto
  ): Promise<GetCalloutResponseCommentDto | undefined> {
    await getRepository(CalloutResponseComment).update(id, data);
    return await CalloutResponseCommentTransformer.fetchOneById(auth, id);
  }

  @OnUndefined(204)
  @Delete("/:id")
  async deleteCalloutResponseComment(
    @Params() { id }: UUIDParams
  ): Promise<void> {
    const result = await getRepository(CalloutResponseComment).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

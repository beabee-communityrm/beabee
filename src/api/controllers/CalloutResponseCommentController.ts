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
      text: data.text,
      contact: contact,
      response: { id: data.responseId }
    });
    return CalloutResponseCommentTransformer.convert(comment);
  }

  @Get("/")
  async getCalloutResponseComments(
    @CurrentUser({ required: true }) caller: Contact,
    @QueryParams() query: ListCalloutResponseCommentsDto
  ): Promise<PaginatedDto<GetCalloutResponseCommentDto>> {
    return await CalloutResponseCommentTransformer.fetch(caller, query);
  }

  @Get("/:id")
  async getCalloutResponseComment(
    @CurrentUser({ required: true }) caller: Contact,
    @Params() { id }: UUIDParams
  ): Promise<GetCalloutResponseCommentDto | undefined> {
    return await CalloutResponseCommentTransformer.fetchOneById(caller, id);
  }

  @Patch("/:id")
  async updateCalloutResponseComment(
    @CurrentUser({ required: true }) caller: Contact,
    @Params() { id }: UUIDParams,
    @PartialBody() data: CreateCalloutResponseCommentDto
  ): Promise<GetCalloutResponseCommentDto | undefined> {
    await getRepository(CalloutResponseComment).update(id, data);
    return await CalloutResponseCommentTransformer.fetchOneById(caller, id);
  }

  @OnUndefined(204)
  @Delete("/:id")
  async deleteCalloutResponseComment(@Params() { id }: UUIDParams) {
    const result = await getRepository(CalloutResponseComment).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

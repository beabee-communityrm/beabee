import { UUIDParam } from "@api/data";
import {
  convertCommentToData,
  fetchPaginatedCalloutResponseComments
} from "@api/data/CalloutResponseCommentData";
import {
  GetCalloutResponseCommentData,
  GetCalloutResponseCommentsQuery,
  CreateCalloutResponseCommentData,
  UpdateCalloutResponseComment
} from "@api/data/CalloutResponseCommentData/interface";
import PartialBody from "@api/decorators/PartialBody";
import { Paginated } from "@beabee/beabee-common";
import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseComment from "@models/CalloutResponseComment";
import Contact from "@models/Contact";
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
import { getRepository } from "typeorm";

@JsonController("/callout-response-comments")
@Authorized("admin")
export class CalloutResponseCommentController {
  @Post("/")
  async createCalloutReponseComment(
    @Body() data: CreateCalloutResponseCommentData,
    @CurrentUser({ required: true }) contact: Contact
  ): Promise<GetCalloutResponseCommentData> {
    const comment: CalloutResponseComment = await getRepository(
      CalloutResponseComment
    ).save({
      text: data.text,
      contact: contact,
      response: { id: data.responseId }
    });
    return convertCommentToData(comment);
  }

  @Get("/")
  async getCalloutResponseComments(
    @QueryParams() query: GetCalloutResponseCommentsQuery
  ): Promise<Paginated<GetCalloutResponseCommentData>> {
    return fetchPaginatedCalloutResponseComments(query);
  }

  @Get("/:id")
  async getCalloutResponseComment(
    @Params() { id }: UUIDParam
  ): Promise<GetCalloutResponseCommentData | undefined> {
    const comment = await getRepository(CalloutResponseComment).findOne({
      where: { id: id },
      relations: ["contact"]
    });
    if (comment) {
      return convertCommentToData(comment);
    }
  }

  @Patch("/:id")
  async updateCalloutResponseComment(
    @Params() { id }: UUIDParam,
    @PartialBody() data: UpdateCalloutResponseComment
  ): Promise<GetCalloutResponseCommentData | undefined> {
    await getRepository(CalloutResponseComment).update(id, data);
    return this.getCalloutResponseComment({ id });
  }

  @OnUndefined(204)
  @Delete("/:id")
  async deleteCalloutResponseComment(@Params() { id }: UUIDParam) {
    const result = await getRepository(CalloutResponseComment).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

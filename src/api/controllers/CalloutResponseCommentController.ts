import { UUIDParam } from "@api/data";
import {
  convertCommentToData,
  fetchPaginatedCalloutResponseComments
} from "@api/data/CalloutResponseCommentData";
import {
  GetCalloutResponseCommentData,
  CalloutResponseCommentData,
  GetCalloutResponseCommentsQuery,
  CreateCalloutResponseCommentData
} from "@api/data/CalloutResponseCommentData/interface";
import PartialBody from "@api/decorators/PartialBody";
import { Paginated } from "@beabee/beabee-common";
import CalloutResponseComment from "@models/CalloutResponseComment";
import Contact from "@models/Contact";
import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  JsonController,
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
    @Body() data: CalloutResponseCommentData,
    @CurrentUser({ required: true }) contact: Contact
  ): Promise<GetCalloutResponseCommentData> {
    const response: CalloutResponseComment = await getRepository(
      CalloutResponseComment
    ).save({ ...data, contact });
    return convertCommentToData(response);
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
    const comment = await getRepository(CalloutResponseComment).findOne(id);
    if (comment) {
      return convertCommentToData(comment);
    }
  }

  @Patch("/:id")
  async updateCalloutResponseComment(
    @Params() { id }: UUIDParam,
    @PartialBody() data: CreateCalloutResponseCommentData
  ): Promise<GetCalloutResponseCommentData | undefined> {
    await getRepository(CalloutResponseComment).update(id, data);
    return this.getCalloutResponseComment({ id });
  }
}

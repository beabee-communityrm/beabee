import { convertCommentToData } from "@api/data/CalloutResponseCommentData";
import {
  GetCalloutResponseCommentData,
  CalloutResponseCommentData
} from "@api/data/CalloutResponseCommentData/interface";
import CalloutResponseComment from "@models/CalloutResponseComment";
import Contact from "@models/Contact";
import {
  Authorized,
  Body,
  CurrentUser,
  JsonController,
  Post
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
    ).save({ contact, ...data });
    return convertCommentToData(response);
  }
}

import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Patch,
  Post,
  QueryParams
} from "routing-controllers";
import { getRepository } from "typeorm";

import PollsService from "@core/services/PollsService";

import Member from "@models/Member";
import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";

import {
  convertCalloutToData,
  CreateCalloutData,
  CreateCalloutResponseData,
  fetchPaginatedCalloutResponses,
  fetchPaginatedCallouts,
  GetCalloutData,
  GetCalloutQuery,
  GetCalloutResponseData,
  GetCalloutResponsesQuery,
  GetCalloutsQuery,
  UpdateCalloutData
} from "@api/data/CalloutData";
import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";
import { Paginated } from "@api/utils/pagination";

abstract class CalloutAdminController {
  @Authorized("admin")
  @Post("/")
  async createCallout(
    @CurrentUser({ required: true }) member: Member,
    @Body() data: CreateCalloutData
  ): Promise<GetCalloutData> {
    await getRepository(Poll).insert(data);
    const poll = await getRepository(Poll).findOne(data.slug);
    // Should be impossible
    if (!poll) {
      throw new Error("Callout just inserted but not found");
    }
    return convertCalloutToData(poll, member, {});
  }

  @Authorized("admin")
  @Patch("/:slug")
  async updateCallout(
    @CurrentUser({ required: true }) member: Member,
    @Param("slug") slug: string,
    @Body() data: UpdateCalloutData
  ): Promise<GetCalloutData | undefined> {
    await getRepository(Poll).update(slug, data);
    const poll = await getRepository(Poll).findOne(slug);
    return poll && convertCalloutToData(poll, member, {});
  }

  @Authorized("admin")
  @OnUndefined(204)
  @Delete("/:slug")
  async deleteCallout(@Param("slug") slug: string): Promise<void> {
    await getRepository(PollResponse).delete({ poll: { slug } });
    const result = await getRepository(Poll).delete(slug);
    if (result.affected === 0) {
      throw new NotFoundError();
    }
  }
}

@JsonController("/callout")
export class CalloutController extends CalloutAdminController {
  @Get("/")
  async getCallouts(
    @CurrentUser() member: Member | undefined,
    @QueryParams() query: GetCalloutsQuery
  ): Promise<Paginated<GetCalloutData>> {
    return fetchPaginatedCallouts(query, member, { with: query.with });
  }

  @Get("/:slug")
  async getCallout(
    @CurrentUser() member: Member | undefined,
    @Param("slug") slug: string,
    @QueryParams() query: GetCalloutQuery
  ): Promise<GetCalloutData | undefined> {
    const poll = await getRepository(Poll).findOne(slug);
    if (poll) {
      return convertCalloutToData(poll, member, { with: query.with });
    }
  }

  @Get("/:slug/responses")
  async getCalloutResponses(
    @CurrentUser({ required: true }) member: Member,
    @Param("slug") slug: string,
    @QueryParams() query: GetCalloutResponsesQuery
  ): Promise<Paginated<GetCalloutResponseData>> {
    return await fetchPaginatedCalloutResponses(slug, query, member);
  }

  @Post("/:slug/responses")
  @OnUndefined(204)
  async createCalloutResponse(
    @CurrentUser({ required: false }) member: Member | undefined,
    @Param("slug") slug: string,
    @Body() data: CreateCalloutResponseData
  ) {
    const poll = await getRepository(Poll).findOne(slug);
    if (!poll) {
      throw new NotFoundError();
    }

    if (member && (data.guestEmail || data.guestName)) {
      throw new InvalidCalloutResponse("logged-in-guest-fields");
    }

    const error = member
      ? await PollsService.setResponse(poll, member, data.answers)
      : await PollsService.setGuestResponse(
          poll,
          data.guestName,
          data.guestEmail,
          data.answers
        );

    if (error) {
      throw new InvalidCalloutResponse(error);
    }
  }
}

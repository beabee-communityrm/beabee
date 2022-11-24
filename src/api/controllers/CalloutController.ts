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
import slugify from "slugify";
import { getRepository } from "typeorm";

import PollsService from "@core/services/PollsService";

import { isDuplicateIndex } from "@core/utils";

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
  GetCalloutsQuery
} from "@api/data/CalloutData";
import { Paginated } from "@api/data/PaginatedData";
import PartialBody from "@api/decorators/PartialBody";
import DuplicateId from "@api/errors/DuplicateId";
import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";

async function createCallout(
  data: CreateCalloutData & { slug: string },
  autoSlug: number | false
): Promise<Poll> {
  const slug = data.slug + (autoSlug > 0 ? "-" + autoSlug : "");
  try {
    await getRepository(Poll).insert({ ...data, slug });
    return await getRepository(Poll).findOneOrFail(slug);
  } catch (err) {
    if (isDuplicateIndex(err, "slug")) {
      if (autoSlug === false) {
        throw new DuplicateId(slug);
      } else {
        return await createCallout(data, autoSlug + 1);
      }
    } else {
      throw err;
    }
  }
}

abstract class CalloutAdminController {
  @Authorized("admin")
  @Post("/")
  async createCallout(
    @CurrentUser({ required: true }) member: Member,
    @Body() data: CreateCalloutData
  ): Promise<GetCalloutData> {
    const poll = await createCallout(
      {
        ...data,
        slug: data.slug || slugify(data.title, { lower: true })
      },
      data.slug ? false : 0
    );
    return convertCalloutToData(poll, member, {});
  }

  @Authorized("admin")
  @Patch("/:slug")
  async updateCallout(
    @CurrentUser({ required: true }) member: Member,
    @Param("slug") slug: string,
    @PartialBody() data: CreateCalloutData // Should be Partial<CreateCalloutData>
  ): Promise<GetCalloutData | undefined> {
    const newSlug = data.slug || slug;
    await getRepository(Poll).update(slug, data);
    try {
      const poll = await getRepository(Poll).findOne(newSlug);
      return poll && convertCalloutToData(poll, member, {});
    } catch (err) {
      throw isDuplicateIndex(err, "slug") ? new DuplicateId(newSlug) : err;
    }
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
    @CurrentUser({ required: false }) member: Member | undefined,
    @QueryParams() query: GetCalloutsQuery
  ): Promise<Paginated<GetCalloutData>> {
    return fetchPaginatedCallouts(query, member, { with: query.with });
  }

  @Get("/:slug")
  async getCallout(
    @CurrentUser({ required: false }) member: Member | undefined,
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
    @CurrentUser() member: Member,
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

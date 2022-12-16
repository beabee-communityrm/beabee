import { ItemStatus } from "@beabee/beabee-common";
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

import CalloutsService from "@core/services/CalloutsService";

import { isDuplicateIndex } from "@core/utils";

import Contact from "@models/Contact";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

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
): Promise<Callout> {
  const slug = data.slug + (autoSlug > 0 ? "-" + autoSlug : "");
  try {
    await getRepository(Callout).insert({ ...data, slug });
    return await getRepository(Callout).findOneOrFail(slug);
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
    @CurrentUser({ required: true }) contact: Contact,
    @Body() data: CreateCalloutData
  ): Promise<GetCalloutData> {
    const callout = await createCallout(
      {
        ...data,
        slug: data.slug || slugify(data.title, { lower: true })
      },
      data.slug ? false : 0
    );
    return convertCalloutToData(callout, contact, {});
  }

  @Authorized("admin")
  @Patch("/:slug")
  async updateCallout(
    @CurrentUser({ required: true }) contact: Contact,
    @Param("slug") slug: string,
    @PartialBody() data: CreateCalloutData // Should be Partial<CreateCalloutData>
  ): Promise<GetCalloutData | undefined> {
    const newSlug = data.slug || slug;
    await getRepository(Callout).update(slug, data);
    try {
      const callout = await getRepository(Callout).findOne(newSlug);
      return callout && convertCalloutToData(callout, contact, {});
    } catch (err) {
      throw isDuplicateIndex(err, "slug") ? new DuplicateId(newSlug) : err;
    }
  }

  @Authorized("admin")
  @OnUndefined(204)
  @Delete("/:slug")
  async deleteCallout(@Param("slug") slug: string): Promise<void> {
    await getRepository(CalloutResponse).delete({ callout: { slug } });
    const result = await getRepository(Callout).delete(slug);
    if (result.affected === 0) {
      throw new NotFoundError();
    }
  }
}

@JsonController("/callout")
export class CalloutController extends CalloutAdminController {
  @Get("/")
  async getCallouts(
    @CurrentUser({ required: false }) contact: Contact | undefined,
    @QueryParams() query: GetCalloutsQuery
  ): Promise<Paginated<GetCalloutData>> {
    return fetchPaginatedCallouts(query, contact, { with: query.with });
  }

  @Get("/:slug")
  async getCallout(
    @CurrentUser({ required: false }) contact: Contact | undefined,
    @Param("slug") slug: string,
    @QueryParams() query: GetCalloutQuery
  ): Promise<GetCalloutData | undefined> {
    const callout = await getRepository(Callout).findOne(slug);
    if (
      callout &&
      (callout.status === ItemStatus.Open ||
        callout.status === ItemStatus.Ended ||
        contact?.hasRole("admin"))
    ) {
      return convertCalloutToData(callout, contact, { with: query.with });
    }
  }

  @Get("/:slug/responses")
  async getCalloutResponses(
    @CurrentUser() contact: Contact,
    @Param("slug") slug: string,
    @QueryParams() query: GetCalloutResponsesQuery
  ): Promise<Paginated<GetCalloutResponseData>> {
    return await fetchPaginatedCalloutResponses(slug, query, contact);
  }

  @Post("/:slug/responses")
  @OnUndefined(204)
  async createCalloutResponse(
    @CurrentUser({ required: false }) contact: Contact | undefined,
    @Param("slug") slug: string,
    @Body() data: CreateCalloutResponseData
  ) {
    const callout = await getRepository(Callout).findOne(slug);
    if (!callout) {
      throw new NotFoundError();
    }

    if (contact && (data.guestEmail || data.guestName)) {
      throw new InvalidCalloutResponse("logged-in-guest-fields");
    }

    const error = contact
      ? await CalloutsService.setResponse(callout, contact, data.answers)
      : await CalloutsService.setGuestResponse(
          callout,
          data.guestName,
          data.guestEmail,
          data.answers
        );

    if (error) {
      throw new InvalidCalloutResponse(error);
    }
  }
}

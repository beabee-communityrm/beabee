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

import CalloutsService from "@core/services/CalloutsService";

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

import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";
import PartialBody from "@api/decorators/PartialBody";

abstract class CalloutAdminController {
  @Authorized("admin")
  @Post("/")
  async createCallout(
    @CurrentUser({ required: true }) contact: Contact,
    @Body() data: CreateCalloutData
  ): Promise<GetCalloutData> {
    await getRepository(Callout).insert(data);
    const callout = await getRepository(Callout).findOne(data.slug);
    // Should be impossible
    if (!callout) {
      throw new Error("Callout just inserted but not found");
    }
    return convertCalloutToData(callout, contact, {});
  }

  @Authorized("admin")
  @Patch("/:slug")
  async updateCallout(
    @CurrentUser({ required: true }) contact: Contact,
    @Param("slug") slug: string,
    @PartialBody() data: CreateCalloutData // Should be Partial<CreateCalloutData>
  ): Promise<GetCalloutData | undefined> {
    await getRepository(Callout).update(slug, data);
    const callout = await getRepository(Callout).findOne(
      data.slug ? data.slug : slug
    );
    return callout && convertCalloutToData(callout, contact, {});
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
    if (callout) {
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

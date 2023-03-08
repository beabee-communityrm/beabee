import { Paginated } from "@beabee/beabee-common";
import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  Params,
  Patch,
  QueryParams
} from "routing-controllers";

import { UUIDParam } from "@api/data";
import {
  BatchUpdateCalloutResponseData,
  batchUpdateCalloutResponses,
  CreateCalloutResponseData,
  fetchCalloutResponse,
  fetchPaginatedCalloutResponses,
  GetCalloutResponseData,
  GetCalloutResponseQuery,
  GetCalloutResponsesQuery,
  updateCalloutResponse
} from "@api/data/CalloutResponseData";
import PartialBody from "@api/decorators/PartialBody";

import Contact from "@models/Contact";

@JsonController("/callout-responses")
export class CalloutResponseController {
  @Get("/")
  async getCalloutResponses(
    @CurrentUser() contact: Contact,
    @QueryParams() query: GetCalloutResponsesQuery
  ): Promise<Paginated<GetCalloutResponseData>> {
    return await fetchPaginatedCalloutResponses(query, contact);
  }

  @Authorized("admin")
  @Patch("/")
  async updateCalloutResponses(
    @CurrentUser() contact: Contact,
    @PartialBody() data: BatchUpdateCalloutResponseData
  ): Promise<{ affected: number }> {
    const affected = await batchUpdateCalloutResponses(data, contact);
    return { affected };
  }

  @Get("/:id")
  async getCalloutResponse(
    @CurrentUser() contact: Contact,
    @Params() { id }: UUIDParam,
    @QueryParams() query: GetCalloutResponseQuery
  ): Promise<GetCalloutResponseData | undefined> {
    return await fetchCalloutResponse(id, query, contact);
  }
}

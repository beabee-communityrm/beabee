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
  CreateCalloutResponseDto,
  fetchCalloutResponse,
  fetchPaginatedCalloutResponses,
  GetCalloutResponseDto,
  GetCalloutResponseOptsDto,
  ListCalloutResponsesDto,
  updateCalloutResponse
} from "@api/data/CalloutResponseData";
import PartialBody from "@api/decorators/PartialBody";

import Contact from "@models/Contact";

@JsonController("/callout-responses")
export class CalloutResponseController {
  @Get("/")
  async getCalloutResponses(
    @CurrentUser() contact: Contact,
    @QueryParams() query: ListCalloutResponsesDto
  ): Promise<Paginated<GetCalloutResponseDto>> {
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
    @QueryParams() query: GetCalloutResponseOptsDto
  ): Promise<GetCalloutResponseDto | undefined> {
    return await fetchCalloutResponse(id, query, contact);
  }
  @Authorized("admin")
  @Patch("/:id")
  async updateCalloutResponse(
    @CurrentUser() contact: Contact,
    @Params() { id }: UUIDParam,
    @PartialBody() data: CreateCalloutResponseDto // Should be Partial<CreateCalloutResponseData>
  ): Promise<GetCalloutResponseDto | undefined> {
    await updateCalloutResponse(id, data);
    return await fetchCalloutResponse(id, {}, contact);
  }
}

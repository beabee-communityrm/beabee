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

import {
  batchUpdateCalloutResponses,
  updateCalloutResponse
} from "@api/data/CalloutResponseData";
import PartialBody from "@api/decorators/PartialBody";
import { UUIDParams } from "@api/params/UUIDParams";

import {
  BatchUpdateCalloutResponseData,
  CreateCalloutResponseDto,
  GetCalloutResponseDto,
  GetCalloutResponseOptsDto,
  ListCalloutResponsesDto
} from "@api/dto/CalloutResponseDto";
import CalloutResponseTransformer from "@api/transformers/CalloutResponseTransformer";

import Contact from "@models/Contact";

@JsonController("/callout-responses")
export class CalloutResponseController {
  @Get("/")
  async getCalloutResponses(
    @CurrentUser() caller: Contact,
    @QueryParams() query: ListCalloutResponsesDto
  ): Promise<Paginated<GetCalloutResponseDto>> {
    return CalloutResponseTransformer.fetch(caller, query);
  }

  @Authorized("admin")
  @Patch("/")
  async updateCalloutResponses(
    @CurrentUser() caller: Contact,
    @PartialBody() data: BatchUpdateCalloutResponseData
  ): Promise<{ affected: number }> {
    const affected = await batchUpdateCalloutResponses(data, caller);
    return { affected };
  }

  @Get("/:id")
  async getCalloutResponse(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParams,
    @QueryParams() query: GetCalloutResponseOptsDto
  ): Promise<GetCalloutResponseDto | undefined> {
    return await CalloutResponseTransformer.fetchOneById(caller, id, query);
  }
  @Authorized("admin")
  @Patch("/:id")
  async updateCalloutResponse(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParams,
    @PartialBody() data: CreateCalloutResponseDto // Should be Partial<CreateCalloutResponseData>
  ): Promise<GetCalloutResponseDto | undefined> {
    await updateCalloutResponse(id, data);
    return await CalloutResponseTransformer.fetchOneById(caller, id);
  }
}

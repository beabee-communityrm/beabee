import { plainToInstance } from "class-transformer";
import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  Params,
  Patch,
  QueryParams
} from "routing-controllers";

import PartialBody from "@api/decorators/PartialBody";
import { UUIDParams } from "@api/params/UUIDParams";

import {
  BatchUpdateCalloutResponseDto,
  BatchUpdateCalloutResponseResultDto,
  CreateCalloutResponseDto,
  GetCalloutResponseDto,
  GetCalloutResponseOptsDto,
  ListCalloutResponsesDto
} from "@api/dto/CalloutResponseDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import CalloutResponseTransformer from "@api/transformers/CalloutResponseTransformer";

import Contact from "@models/Contact";

@JsonController("/callout-responses")
export class CalloutResponseController {
  @Get("/")
  async getCalloutResponses(
    @CurrentUser() caller: Contact,
    @QueryParams() query: ListCalloutResponsesDto
  ): Promise<PaginatedDto<GetCalloutResponseDto>> {
    return CalloutResponseTransformer.fetch(caller, query);
  }

  @Authorized("admin")
  @Patch("/")
  async updateCalloutResponses(
    @CurrentUser() caller: Contact,
    @PartialBody() data: BatchUpdateCalloutResponseDto
  ): Promise<BatchUpdateCalloutResponseResultDto> {
    const affected = await CalloutResponseTransformer.update(caller, data);
    return plainToInstance(BatchUpdateCalloutResponseResultDto, { affected });
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
    await CalloutResponseTransformer.updateOneById(caller, id, data);
    return await CalloutResponseTransformer.fetchOneById(caller, id);
  }
}

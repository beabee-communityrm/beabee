import { plainToInstance } from "class-transformer";
import {
  Authorized,
  Get,
  JsonController,
  Params,
  Patch,
  QueryParams
} from "routing-controllers";

import { CurrentAuth } from "@api/decorators/CurrentAuth";
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

import { AuthInfo } from "@type/auth-info";

@JsonController("/callout-responses")
export class CalloutResponseController {
  @Get("/")
  async getCalloutResponses(
    @CurrentAuth() auth: AuthInfo | undefined,
    @QueryParams() query: ListCalloutResponsesDto
  ): Promise<PaginatedDto<GetCalloutResponseDto>> {
    return CalloutResponseTransformer.fetch(auth, query);
  }

  @Authorized("admin")
  @Patch("/")
  async updateCalloutResponses(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @PartialBody() data: BatchUpdateCalloutResponseDto
  ): Promise<BatchUpdateCalloutResponseResultDto> {
    const affected = await CalloutResponseTransformer.update(auth, data);
    return plainToInstance(BatchUpdateCalloutResponseResultDto, { affected });
  }

  @Get("/:id")
  async getCalloutResponse(
    @CurrentAuth() auth: AuthInfo | undefined,
    @Params() { id }: UUIDParams,
    @QueryParams() query: GetCalloutResponseOptsDto
  ): Promise<GetCalloutResponseDto | undefined> {
    return await CalloutResponseTransformer.fetchOneById(auth, id, query);
  }
  @Authorized("admin")
  @Patch("/:id")
  async updateCalloutResponse(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Params() { id }: UUIDParams,
    @PartialBody() data: CreateCalloutResponseDto // Should be Partial<CreateCalloutResponseData>
  ): Promise<GetCalloutResponseDto | undefined> {
    await CalloutResponseTransformer.updateOneById(auth, id, data);
    return await CalloutResponseTransformer.fetchOneById(auth, id);
  }
}

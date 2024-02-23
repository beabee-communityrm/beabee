import { Response } from "express";
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
  QueryParam,
  QueryParams,
  Res
} from "routing-controllers";

import CalloutsService from "@core/services/CalloutsService";

import { getRepository } from "@core/database";

import { GetExportQuery } from "@api/dto/BaseDto";

import {
  CreateCalloutDto,
  GetCalloutDto,
  GetCalloutOptsDto,
  ListCalloutsDto
} from "@api/dto/CalloutDto";
import {
  CreateCalloutResponseDto,
  GetCalloutResponseDto,
  GetCalloutResponseMapDto,
  ListCalloutResponsesDto
} from "@api/dto/CalloutResponseDto";
import { CreateCalloutTagDto, GetCalloutTagDto } from "@api/dto/CalloutTagDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";

import { CalloutId } from "@api/decorators/CalloutId";
import { CurrentAuth } from "@api/decorators/CurrentAuth";
import PartialBody from "@api/decorators/PartialBody";
import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";
import CalloutTagTransformer from "@api/transformers/CalloutTagTransformer";
import CalloutTransformer from "@api/transformers/CalloutTransformer";
import CalloutResponseExporter from "@api/transformers/CalloutResponseExporter";
import CalloutResponseMapTransformer from "@api/transformers/CalloutResponseMapTransformer";
import CalloutResponseTransformer from "@api/transformers/CalloutResponseTransformer";
import { validateOrReject } from "@api/utils";

import Callout from "@models/Callout";
import CalloutResponseTag from "@models/CalloutResponseTag";
import CalloutTag from "@models/CalloutTag";
import Contact from "@models/Contact";

import { AuthInfo } from "@type/auth-info";

@JsonController("/callout")
export class CalloutController {
  @Get("/")
  async getCallouts(
    @CurrentAuth() auth: AuthInfo | undefined,
    @QueryParams() query: ListCalloutsDto
  ): Promise<PaginatedDto<GetCalloutDto>> {
    return CalloutTransformer.fetch(auth, query);
  }

  @Authorized("admin")
  @Post("/")
  async createCallout(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @QueryParam("fromId") fromId: string,
    @Body({ validate: false, required: false }) data: CreateCalloutDto
  ): Promise<GetCalloutDto> {
    // Allow partial body if duplicating
    await validateOrReject(data, { skipMissingProperties: !!fromId });

    let id;
    if (fromId) {
      id = await CalloutsService.duplicateCallout(fromId);
      if (Object.keys(data).length > 0) {
        await CalloutsService.updateCallout(id, data);
      }
    } else {
      id = await CalloutsService.createCallout(data, data.slug ? false : 0);
    }

    return CalloutTransformer.fetchOneByIdOrFail(auth, id);
  }

  @Get("/:id")
  async getCallout(
    @CurrentAuth() auth: AuthInfo | undefined,
    @CalloutId() id: string,
    @QueryParams() query: GetCalloutOptsDto
  ): Promise<GetCalloutDto | undefined> {
    return CalloutTransformer.fetchOneById(auth, id, {
      ...query,
      showHiddenForAll: true
    });
  }

  @Authorized("admin")
  @Patch("/:id")
  async updateCallout(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @CalloutId() id: string,
    @PartialBody() data: CreateCalloutDto // Actually Partial<CreateCalloutDto>
  ): Promise<GetCalloutDto | undefined> {
    await CalloutsService.updateCallout(id, data);
    return CalloutTransformer.fetchOneById(auth, id);
  }

  @Authorized("admin")
  @OnUndefined(204)
  @Delete("/:slug")
  async deleteCallout(@CalloutId() id: string): Promise<void> {
    const deleted = await CalloutsService.deleteCallout(id);
    if (!deleted) {
      throw new NotFoundError();
    }
  }

  @Get("/:id/responses")
  async getCalloutResponses(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @CalloutId() id: string,
    @QueryParams() query: ListCalloutResponsesDto
  ): Promise<PaginatedDto<GetCalloutResponseDto>> {
    return await CalloutResponseTransformer.fetchForCallout(auth, id, query);
  }

  @Get("/:id/responses.csv")
  async exportCalloutResponses(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @CalloutId() id: string,
    @QueryParams() query: GetExportQuery,
    @Res() res: Response
  ): Promise<Response> {
    const [exportName, exportData] = await CalloutResponseExporter.export(
      auth,
      id,
      query
    );
    res.attachment(exportName).send(exportData);
    return res;
  }

  @Get("/:id/responses/map")
  async getCalloutResponsesMap(
    @CurrentAuth() auth: AuthInfo | undefined,
    @CalloutId() id: string,
    @QueryParams() query: ListCalloutResponsesDto
  ): Promise<PaginatedDto<GetCalloutResponseMapDto>> {
    return await CalloutResponseMapTransformer.fetchForCallout(auth, id, query);
  }

  @Post("/:id/responses")
  @OnUndefined(204)
  async createCalloutResponse(
    @CurrentUser({ required: false }) caller: Contact | undefined,
    @CalloutId() id: string,
    @Body() data: CreateCalloutResponseDto
  ): Promise<void> {
    const callout = await getRepository(Callout).findOneBy({ id });
    if (!callout) {
      throw new NotFoundError();
    }

    if (caller && (data.guestEmail || data.guestName)) {
      throw new InvalidCalloutResponse("logged-in-guest-fields");
    }

    // TODO: support assignee/bucket/tags on create
    if (!caller || callout.access === "only-anonymous") {
      await CalloutsService.setGuestResponse(
        callout,
        data.guestName,
        data.guestEmail,
        data.answers
      );
    } else {
      await CalloutsService.setResponse(callout, caller, data.answers);
    }
  }

  @Authorized("admin")
  @Get("/:id/tags")
  async getCalloutTags(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @CalloutId() id: string
  ): Promise<GetCalloutTagDto[]> {
    const result = await CalloutTagTransformer.fetch(auth, {
      rules: {
        condition: "AND",
        rules: [{ field: "calloutId", operator: "equal", value: [id] }]
      }
    });

    return result.items;
  }

  @Authorized("admin")
  @Post("/:id/tags")
  async createCalloutTag(
    @CalloutId() id: string,
    @Body() data: CreateCalloutTagDto
  ): Promise<GetCalloutTagDto> {
    // TODO: handle foreign key error
    const tag = await getRepository(CalloutTag).save({
      name: data.name,
      description: data.description,
      calloutId: id
    });

    return CalloutTagTransformer.convert(tag);
  }

  @Authorized("admin")
  @Get("/:id/tags/:tagId")
  async getCalloutTag(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Param("tagId") tagId: string
  ): Promise<GetCalloutTagDto | undefined> {
    return CalloutTagTransformer.fetchOneById(auth, tagId);
  }

  @Authorized("admin")
  @Patch("/:id/tags/:tagId")
  async updateCalloutTag(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @CalloutId() id: string,
    @Param("tagId") tagId: string,
    @PartialBody() data: CreateCalloutTagDto // Partial<CreateCalloutTagData>
  ): Promise<GetCalloutTagDto | undefined> {
    await getRepository(CalloutTag).update({ id: tagId, calloutId: id }, data);

    return CalloutTagTransformer.fetchOneById(auth, tagId);
  }

  @Authorized("admin")
  @Delete("/:id/tags/:tagId")
  @OnUndefined(204)
  async deleteCalloutTag(
    @CalloutId() id: string,
    @Param("tagId") tagId: string
  ): Promise<void> {
    await getRepository(CalloutResponseTag).delete({ tag: { id: tagId } });
    const result = await getRepository(CalloutTag).delete({
      calloutId: id,
      id: tagId
    });
    if (result.affected === 0) {
      throw new NotFoundError();
    }
  }
}

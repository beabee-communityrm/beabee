import { CalloutFormSchema } from "@beabee/beabee-common";
import { Response } from "express";
import {
  Authorized,
  BadRequestError,
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
  QueryParams,
  Res
} from "routing-controllers";
import slugify from "slugify";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import CalloutsService from "@core/services/CalloutsService";
import OptionsService from "@core/services/OptionsService";

import { getRepository } from "@core/database";
import { isDuplicateIndex } from "@core/utils";

import { GetExportQuery, Paginated } from "@api/data/PaginatedData";
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

import PartialBody from "@api/decorators/PartialBody";
import DuplicateId from "@api/errors/DuplicateId";
import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";
import CalloutTagTransformer from "@api/transformers/CalloutTagTransformer";
import CalloutTransformer from "@api/transformers/CalloutTransformer";
import CalloutResponseExporter from "@api/transformers/CalloutResponseExporter";
import CalloutResponseTransformer from "@api/transformers/CalloutResponseTransformer";

import Contact from "@models/Contact";
import Callout, { CalloutResponseViewSchema } from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseTag from "@models/CalloutResponseTag";
import CalloutTag from "@models/CalloutTag";
import CalloutResponseMapTransformer from "@api/transformers/CalloutResponseMapTransformer";

@JsonController("/callout")
export class CalloutController {
  @Get("/")
  async getCallouts(
    @CurrentUser({ required: false }) caller: Contact | undefined,
    @QueryParams() query: ListCalloutsDto
  ): Promise<Paginated<GetCalloutDto>> {
    return CalloutTransformer.fetch(caller, query);
  }

  @Authorized("admin")
  @Post("/")
  async createCallout(@Body() data: CreateCalloutDto): Promise<GetCalloutDto> {
    const callout = await CalloutsService.createCallout(
      {
        ...data,
        slug: data.slug || slugify(data.title, { lower: true })
      },
      data.slug ? false : 0
    );
    return CalloutTransformer.convert(callout);
  }

  @Get("/:slug")
  async getCallout(
    @CurrentUser({ required: false }) caller: Contact | undefined,
    @Param("slug") slug: string,
    @QueryParams() query: GetCalloutOptsDto
  ): Promise<GetCalloutDto | undefined> {
    return CalloutTransformer.fetchOneById(caller, slug, {
      ...query,
      showHiddenForAll: true
    });
  }

  @Authorized("admin")
  @Patch("/:slug")
  async updateCallout(
    @CurrentUser({ required: true }) caller: Contact,
    @Param("slug") slug: string,
    @PartialBody() data: CreateCalloutDto // Should be Partial<CreateCalloutData>
  ): Promise<GetCalloutDto | undefined> {
    const newSlug = data.slug || slug;

    if (OptionsService.getText("join-survey") === slug) {
      if (data.expires) {
        throw new BadRequestError(
          "Cannot set an expiry date on the join survey"
        );
      } else if (data.starts === null) {
        throw new BadRequestError("Cannot set join survey to draft");
      } else if (data.starts && data.starts > new Date()) {
        throw new BadRequestError("Cannot set join survey to scheduled");
      }
    }

    try {
      await getRepository(Callout).update(slug, {
        ...data,
        // Force the correct type as otherwise this errors, not sure why
        ...(data.formSchema && {
          formSchema:
            data.formSchema as QueryDeepPartialEntity<CalloutFormSchema>
        })
      });
      return await CalloutTransformer.fetchOneById(caller, newSlug);
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

  @Get("/:slug/responses")
  async getCalloutResponses(
    @CurrentUser() caller: Contact,
    @Param("slug") slug: string,
    @QueryParams() query: ListCalloutResponsesDto
  ) {
    return await CalloutResponseTransformer.fetchForCallout(
      caller,
      slug,
      query
    );
  }

  @Get("/:slug/responses.csv")
  async exportCalloutResponses(
    @CurrentUser() caller: Contact,
    @Param("slug") slug: string,
    @QueryParams() query: GetExportQuery,
    @Res() res: Response
  ): Promise<Response> {
    const [exportName, exportData] = await CalloutResponseExporter.export(
      caller,
      slug,
      query
    );
    res.attachment(exportName).send(exportData);
    return res;
  }

  @Get("/:slug/responses/map")
  async getCalloutResponsesMap(
    @CurrentUser({ required: false }) caller: Contact | undefined,
    @Param("slug") slug: string,
    @QueryParams() query: ListCalloutResponsesDto
  ): Promise<Paginated<GetCalloutResponseMapDto>> {
    return await CalloutResponseMapTransformer.fetchForCallout(
      caller,
      slug,
      query
    );
  }

  @Post("/:slug/responses")
  @OnUndefined(204)
  async createCalloutResponse(
    @CurrentUser({ required: false }) caller: Contact | undefined,
    @Param("slug") slug: string,
    @Body() data: CreateCalloutResponseDto
  ): Promise<void> {
    const callout = await getRepository(Callout).findOneBy({ slug });
    if (!callout) {
      throw new NotFoundError();
    }

    if (caller && (data.guestEmail || data.guestName)) {
      throw new InvalidCalloutResponse("logged-in-guest-fields");
    }

    // TODO: support assignee/bucket/tags on create
    if (caller) {
      await CalloutsService.setResponse(callout, caller, data.answers);
    } else {
      await CalloutsService.setGuestResponse(
        callout,
        data.guestName,
        data.guestEmail,
        data.answers
      );
    }
  }

  @Authorized("admin")
  @Get("/:slug/tags")
  async getCalloutTags(
    @CurrentUser() caller: Contact,
    @Param("slug") slug: string
  ): Promise<GetCalloutTagDto[]> {
    const result = await CalloutTagTransformer.fetch(caller, {
      rules: {
        condition: "AND",
        rules: [{ field: "calloutSlug", operator: "equal", value: [slug] }]
      }
    });

    return result.items;
  }

  @Authorized("admin")
  @Post("/:slug/tags")
  async createCalloutTag(
    @Param("slug") slug: string,
    @Body() data: CreateCalloutTagDto
  ): Promise<GetCalloutTagDto> {
    // TODO: handle foreign key error
    const tag = await getRepository(CalloutTag).save({
      name: data.name,
      description: data.description,
      calloutSlug: slug
    });

    return CalloutTagTransformer.convert(tag);
  }

  @Authorized("admin")
  @Get("/:slug/tags/:tag")
  async getCalloutTag(
    @CurrentUser() caller: Contact,
    @Param("tag") tagId: string
  ): Promise<GetCalloutTagDto | undefined> {
    return CalloutTagTransformer.fetchOneById(caller, tagId);
  }

  @Authorized("admin")
  @Patch("/:slug/tags/:tag")
  async updateCalloutTag(
    @CurrentUser() caller: Contact,
    @Param("slug") slug: string,
    @Param("tag") tagId: string,
    @PartialBody() data: CreateCalloutTagDto // Partial<CreateCalloutTagData>
  ): Promise<GetCalloutTagDto | undefined> {
    await getRepository(CalloutTag).update(
      { id: tagId, callout: { slug } },
      data
    );

    return CalloutTagTransformer.fetchOneById(caller, tagId);
  }

  @Authorized("admin")
  @Delete("/:slug/tags/:tag")
  @OnUndefined(204)
  async deleteCalloutTag(
    @Param("slug") slug: string,
    @Param("tag") tagId: string
  ): Promise<void> {
    await getRepository(CalloutResponseTag).delete({ tag: { id: tagId } });
    const result = await getRepository(CalloutTag).delete({
      callout: { slug },
      id: tagId
    });
    if (result.affected === 0) {
      throw new NotFoundError();
    }
  }
}

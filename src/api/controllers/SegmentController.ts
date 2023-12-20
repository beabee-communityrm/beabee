import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Params,
  Patch,
  Post,
  QueryParams
} from "routing-controllers";

import { getRepository } from "@core/database";

import { UUIDParam } from "@api/data";
import {
  GetContactsQuery,
  fetchPaginatedContacts
} from "@api/data/ContactData";
import { Paginated } from "@api/data/PaginatedData";
import {
  GetSegmentDto,
  ListSegmentsDto,
  CreateSegmentDto,
  GetSegmentWith,
  GetSegmentOptsDto
} from "@api/dto/SegmentDto";
import PartialBody from "@api/decorators/PartialBody";
import SegmentTransformer from "@api/transformers/SegmentTransformer";

import Contact from "@models/Contact";
import Segment from "@models/Segment";
import SegmentContact from "@models/SegmentContact";
import SegmentOngoingEmail from "@models/SegmentOngoingEmail";

import type { GetContactData } from "@type/get-contact-data";

@JsonController("/segments")
@Authorized("admin")
export class SegmentController {
  @Get("/")
  async getSegments(
    @CurrentUser() caller: Contact,
    @QueryParams() query: ListSegmentsDto
  ): Promise<GetSegmentDto[]> {
    const result = await SegmentTransformer.fetch(caller, query);
    return result.items;
  }

  @Post("/")
  async createSegment(
    @CurrentUser() caller: Contact,
    @Body() data: CreateSegmentDto
  ): Promise<GetSegmentDto> {
    // Default to inserting new segment at the bottom
    if (data.order === undefined) {
      const bottomSegment = await getRepository(Segment).findOne({
        order: { order: "DESC" }
      });
      data.order = bottomSegment ? bottomSegment.order + 1 : 0;
    }
    const segment = await getRepository(Segment).save(data);

    return await SegmentTransformer.fetchOneByIdOrFail(caller, segment.id, {
      with: [GetSegmentWith.contactCount]
    });
  }

  @Get("/:id")
  async getSegment(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParam,
    @QueryParams() opts: GetSegmentOptsDto
  ): Promise<GetSegmentDto | undefined> {
    return await SegmentTransformer.fetchOneById(caller, id, opts);
  }

  @Patch("/:id")
  async updateSegment(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParam,
    @PartialBody() data: CreateSegmentDto
  ): Promise<GetSegmentDto | undefined> {
    await getRepository(Segment).update(id, data);
    return await SegmentTransformer.fetchOneById(caller, id, {
      with: [GetSegmentWith.contactCount]
    });
  }

  @Delete("/:id")
  @OnUndefined(204)
  async deleteSegment(@Params() { id }: UUIDParam): Promise<void> {
    await getRepository(SegmentContact).delete({ segment: { id } });
    await getRepository(SegmentOngoingEmail).delete({ segment: { id } });
    const result = await getRepository(Segment).delete(id);
    if (result.affected === 0) {
      throw new NotFoundError();
    }
  }

  @Get("/:id/contacts")
  async getSegmentContacts(
    @Params() { id }: UUIDParam,
    @QueryParams() query: GetContactsQuery
  ): Promise<Paginated<GetContactData> | undefined> {
    const segment = await getRepository(Segment).findOneBy({ id });
    if (segment) {
      return await fetchPaginatedContacts(
        {
          ...query,
          rules: query.rules
            ? {
                condition: "AND",
                rules: [segment.ruleGroup, query.rules]
              }
            : segment.ruleGroup
        },
        { withRestricted: true }
      );
    }
  }
}

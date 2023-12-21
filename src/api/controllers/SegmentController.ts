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

import { Paginated } from "@api/data/PaginatedData";
import { GetContactDto, ListContactsDto } from "@api/dto/ContactDto";
import {
  GetSegmentDto,
  ListSegmentsDto,
  CreateSegmentDto,
  GetSegmentWith,
  GetSegmentOptsDto
} from "@api/dto/SegmentDto";
import PartialBody from "@api/decorators/PartialBody";
import { UUIDParams } from "@api/params/UUIDParams";
import ContactTransformer from "@api/transformers/ContactTransformer";
import SegmentTransformer from "@api/transformers/SegmentTransformer";

import Contact from "@models/Contact";
import Segment from "@models/Segment";
import SegmentContact from "@models/SegmentContact";
import SegmentOngoingEmail from "@models/SegmentOngoingEmail";

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

    // Use fetchOne to ensure that the segment has a contactCount
    return await SegmentTransformer.fetchOneByIdOrFail(caller, segment.id, {
      with: [GetSegmentWith.contactCount]
    });
  }

  @Get("/:id")
  async getSegment(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParams,
    @QueryParams() opts: GetSegmentOptsDto
  ): Promise<GetSegmentDto | undefined> {
    return await SegmentTransformer.fetchOneById(caller, id, opts);
  }

  @Patch("/:id")
  async updateSegment(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParams,
    @PartialBody() data: CreateSegmentDto
  ): Promise<GetSegmentDto | undefined> {
    await getRepository(Segment).update(id, data);
    return await SegmentTransformer.fetchOneById(caller, id, {
      with: [GetSegmentWith.contactCount]
    });
  }

  @Delete("/:id")
  @OnUndefined(204)
  async deleteSegment(@Params() { id }: UUIDParams): Promise<void> {
    await getRepository(SegmentContact).delete({ segment: { id } });
    await getRepository(SegmentOngoingEmail).delete({ segment: { id } });
    const result = await getRepository(Segment).delete(id);
    if (result.affected === 0) {
      throw new NotFoundError();
    }
  }

  @Get("/:id/contacts")
  async getSegmentContacts(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParams,
    @QueryParams() query: ListContactsDto
  ): Promise<Paginated<GetContactDto> | undefined> {
    const segment = await getRepository(Segment).findOneBy({ id });
    if (segment) {
      return await ContactTransformer.fetch(caller, {
        ...query,
        rules: query.rules
          ? {
              condition: "AND",
              rules: [segment.ruleGroup, query.rules]
            }
          : segment.ruleGroup
      });
    }
  }
}

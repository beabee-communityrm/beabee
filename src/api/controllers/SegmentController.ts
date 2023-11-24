import {
  Authorized,
  Body,
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
import { getRepository } from "typeorm";

import { UUIDParam } from "@api/data";
import {
  GetContactsQuery,
  fetchPaginatedContacts
} from "@api/data/ContactData";
import {
  GetSegmentData,
  GetSegmentQuery,
  CreateSegmentData,
  convertSegmentToData,
  GetSegmentWith
} from "@api/data/SegmentData";
import { Paginated } from "@api/data/PaginatedData";

import PartialBody from "@api/decorators/PartialBody";

import Segment from "@models/Segment";
import SegmentContact from "@models/SegmentContact";
import SegmentOngoingEmail from "@models/SegmentOngoingEmail";

import type { GetContactData } from "@type/get-contact-data";

@JsonController("/segments")
@Authorized("admin")
export class SegmentController {
  @Get("/")
  async getSegments(
    @QueryParams() query: GetSegmentQuery
  ): Promise<GetSegmentData[]> {
    const segments = await getRepository(Segment).find({
      order: { order: "ASC" }
    });
    const out: GetSegmentData[] = [];
    for (const segment of segments) {
      out.push(await convertSegmentToData(segment, query));
    }
    return out;
  }

  @Post("/")
  async createSegment(
    @Body() data: CreateSegmentData
  ): Promise<GetSegmentData> {
    // Default to inserting new segment at the bottom
    if (data.order === undefined) {
      const bottomSegment = await getRepository(Segment).findOne({
        order: { order: "DESC" }
      });
      data.order = bottomSegment ? bottomSegment.order + 1 : 0;
    }
    const segment = await getRepository(Segment).save(data);
    return convertSegmentToData(segment, {
      with: [GetSegmentWith.contactCount]
    });
  }

  @Get("/:id")
  async getSegment(
    @Params() { id }: UUIDParam,
    @QueryParams() query: GetSegmentQuery
  ): Promise<GetSegmentData | undefined> {
    const segment = await getRepository(Segment).findOne(id);
    if (segment) {
      return convertSegmentToData(segment, query);
    }
  }

  @Patch("/:id")
  async updateSegment(
    @Params() { id }: UUIDParam,
    @PartialBody() data: CreateSegmentData
  ): Promise<GetSegmentData | undefined> {
    await getRepository(Segment).update(id, data);
    return await this.getSegment(
      { id },
      { with: [GetSegmentWith.contactCount] }
    );
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
    const segment = await getRepository(Segment).findOne(id);
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

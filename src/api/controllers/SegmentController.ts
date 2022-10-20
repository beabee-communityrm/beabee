import { UUIDParam } from "@api/data";
import {
  GetMemberData,
  GetMembersQuery,
  fetchPaginatedMembers
} from "@api/data/MemberData";
import { Paginated } from "@api/data/PaginatedData";
import SegmentService from "@core/services/SegmentService";
import Segment from "@models/Segment";
import {
  Authorized,
  Get,
  JsonController,
  Params,
  QueryParams
} from "routing-controllers";
import { getRepository } from "typeorm";

interface GetSegmentData extends Segment {}

@JsonController("/segments")
@Authorized("admin")
export class SegmentController {
  @Get("/")
  async getSegments(): Promise<GetSegmentData[]> {
    return await SegmentService.getSegmentsWithCount();
  }

  @Get("/:id")
  async getSegment(
    @Params() { id }: UUIDParam
  ): Promise<GetSegmentData | undefined> {
    const segment = await getRepository(Segment).findOne(id);
    if (segment) {
      segment.memberCount = await SegmentService.getSegmentMemberCount(segment);
      return segment;
    }
  }

  @Get("/:id/members")
  async getSegmentMembers(
    @Params() { id }: UUIDParam,
    @QueryParams() query: GetMembersQuery
  ): Promise<Paginated<GetMemberData> | undefined> {
    const segment = await getRepository(Segment).findOne(id);
    if (segment) {
      return await fetchPaginatedMembers(
        {
          ...query,
          rules: query.rules
            ? {
                condition: "AND",
                rules: [segment.ruleGroup, query.rules]
              }
            : segment.ruleGroup
        },
        { withRestricted: true, with: query.with }
      );
    }
  }
}

import { UUIDParam } from "@api/data";
import {
  GetMemberData,
  GetMembersQuery,
  GetMembersRuleGroup
} from "@api/data/MemberData";
import { fetchPaginatedMembers } from "@api/utils/members";
import { Paginated } from "@api/utils/pagination";
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
      const ruleGroup = segment.ruleGroup as GetMembersRuleGroup;
      return await fetchPaginatedMembers(
        {
          ...query,
          rules: query.rules
            ? {
                condition: "AND",
                rules: [ruleGroup, query.rules]
              }
            : ruleGroup
        },
        { withRestricted: true, with: query.with }
      );
    }
  }
}

import { contactFilters, validateRuleGroup } from "@beabee/beabee-common";
import { getRepository } from "typeorm";

import Member from "@models/Member";
import Segment from "@models/Segment";

import {
  fetchPaginatedMembers,
  specialMemberFields
} from "@api/data/MemberData";
import { buildQuery } from "@api/data/PaginatedData";

class SegmentService {
  async createSegment(
    name: string,
    ruleGroup: Segment["ruleGroup"]
  ): Promise<Segment> {
    const segment = new Segment();
    segment.name = name;
    segment.ruleGroup = ruleGroup;
    return await getRepository(Segment).save(segment);
  }

  async getSegmentsWithCount(): Promise<Segment[]> {
    const segments = await getRepository(Segment).find({
      order: { order: "ASC" }
    });
    for (const segment of segments) {
      segment.memberCount = await this.getSegmentMemberCount(segment);
    }
    return segments;
  }

  async getSegmentMemberCount(segment: Segment): Promise<number> {
    return (
      await fetchPaginatedMembers(
        {
          limit: 0,
          rules: segment.ruleGroup
        },
        { withRestricted: false }
      )
    ).total;
  }

  async getSegmentMembers(segment: Segment): Promise<Member[]> {
    const validatedRuleGroup = validateRuleGroup(
      contactFilters,
      segment.ruleGroup
    );
    const qb = buildQuery(
      Member,
      validatedRuleGroup,
      undefined,
      specialMemberFields
    );

    qb.leftJoinAndSelect("item.profile", "profile").leftJoinAndSelect(
      "item.permissions",
      "mp"
    );

    return await qb.getMany();
  }

  async updateSegment(
    segmentId: string,
    updates: Partial<Segment>
  ): Promise<void> {
    await getRepository(Segment).update(segmentId, updates);
  }
}

export default new SegmentService();

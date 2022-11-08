import { getRepository } from "typeorm";

import Segment from "@models/Segment";
import { fetchPaginatedMembers } from "@api/data/MemberData";

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

  async updateSegment(
    segmentId: string,
    updates: Partial<Segment>
  ): Promise<void> {
    await getRepository(Segment).update(segmentId, updates);
  }
}

export default new SegmentService();

import { getRepository } from "typeorm";

import Segment from "@models/Segment";

import { RuleGroup, buildQuery } from "@core/utils/rules";

class SegmentService {
  async createSegment(name: string, ruleGroup: RuleGroup): Promise<Segment> {
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
    return await buildQuery(segment.ruleGroup).getCount();
  }

  async updateSegment(
    segmentId: string,
    updates: Partial<Segment>
  ): Promise<void> {
    await getRepository(Segment).update(segmentId, updates);
  }
}

export default new SegmentService();

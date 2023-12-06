import { contactFilters, validateRuleGroup } from "@beabee/beabee-common";

import { getRepository } from "@core/database";

import Contact from "@models/Contact";
import Segment from "@models/Segment";

import {
  fetchPaginatedContacts,
  contactFieldHandlers
} from "@api/data/ContactData";
import { buildSelectQuery } from "@api/data/PaginatedData";

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
      segment.contactCount = await this.getSegmentContactCount(segment);
    }
    return segments;
  }

  async getSegmentContactCount(segment: Segment): Promise<number> {
    return (
      await fetchPaginatedContacts(
        {
          limit: 0,
          rules: segment.ruleGroup
        },
        { withRestricted: false }
      )
    ).total;
  }

  async getSegmentContacts(segment: Segment): Promise<Contact[]> {
    const validatedRuleGroup = validateRuleGroup(
      contactFilters,
      segment.ruleGroup
    );
    const qb = buildSelectQuery(
      Contact,
      validatedRuleGroup,
      undefined,
      contactFieldHandlers
    );

    qb.leftJoinAndSelect("item.profile", "profile").leftJoinAndSelect(
      "item.roles",
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

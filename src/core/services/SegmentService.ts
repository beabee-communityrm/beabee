import { contactFilters, validateRuleGroup } from "@beabee/beabee-common";

import { getRepository } from "@core/database";

import Contact from "@models/Contact";
import Segment from "@models/Segment";

import { buildSelectQuery } from "@api/data/PaginatedData";
import ContactTransformer from "@api/transformers/ContactTransformer";

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

  /** @deprecated */
  async getSegmentsWithCount(caller: Contact | undefined): Promise<Segment[]> {
    const segments = await getRepository(Segment).find({
      order: { order: "ASC" }
    });
    for (const segment of segments) {
      const result = await ContactTransformer.fetch(caller, {
        limit: 0,
        rules: segment.ruleGroup
      });
      segment.contactCount = result.total;
    }
    return segments;
  }

  /** @deprecated */
  async getSegmentContacts(segment: Segment): Promise<Contact[]> {
    const validatedRuleGroup = validateRuleGroup(
      contactFilters,
      segment.ruleGroup
    );
    const qb = buildSelectQuery(
      Contact,
      validatedRuleGroup,
      undefined,
      ContactTransformer.getFieldHandlers()
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

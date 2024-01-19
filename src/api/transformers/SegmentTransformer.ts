import { Paginated, RoleType } from "@beabee/beabee-common";
import {
  GetSegmentDto,
  GetSegmentOptsDto,
  GetSegmentWith,
  ListSegmentsDto
} from "@api/dto/SegmentDto";

import { BaseTransformer } from "@api/transformers/BaseTransformer";
import ContactTransformer from "@api/transformers/ContactTransformer";

import Segment from "@models/Segment";

import { AuthInfo } from "@type/auth-info";

class SegmentTransformer extends BaseTransformer<
  Segment,
  GetSegmentDto,
  never,
  GetSegmentOptsDto
> {
  protected model = Segment;
  protected filters = {};

  protected allowedRoles: RoleType[] = ["admin"];

  convert(segment: Segment, opts: GetSegmentOptsDto): GetSegmentDto {
    return {
      id: segment.id,
      name: segment.name,
      description: segment.description,
      ruleGroup: segment.ruleGroup,
      order: segment.order,
      ...(opts.with?.includes(GetSegmentWith.contactCount) && {
        contactCount: segment.contactCount
      })
    };
  }

  protected async modifyResult(
    result: Paginated<Segment>,
    query: ListSegmentsDto,
    auth: AuthInfo | undefined
  ): Promise<void> {
    if (query.with?.includes(GetSegmentWith.contactCount)) {
      for (const segment of result.items) {
        const result = await ContactTransformer.fetch(auth, {
          limit: 0,
          rules: segment.ruleGroup
        });
        segment.contactCount = result.total;
      }
    }
  }
}

export default new SegmentTransformer();

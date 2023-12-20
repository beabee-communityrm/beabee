import SegmentService from "@core/services/SegmentService";

import {
  GetSegmentDto,
  GetSegmentOptsDto,
  GetSegmentWith,
  ListSegmentsDto
} from "@api/dto/SegmentDto";

import Segment from "@models/Segment";
import { BaseTransformer } from "./BaseTransformer";
import { Paginated, RoleType } from "@beabee/beabee-common";

class SegmentTransformer extends BaseTransformer<
  Segment,
  GetSegmentDto,
  never,
  GetSegmentOptsDto
> {
  model = Segment;
  filters = {};

  allowedRoles: RoleType[] = ["admin"];

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
    query: ListSegmentsDto
  ): Promise<void> {
    if (query.with?.includes(GetSegmentWith.contactCount)) {
      for (const segment of result.items) {
        segment.contactCount =
          await SegmentService.getSegmentContactCount(segment);
      }
    }
  }
}

export default new SegmentTransformer();

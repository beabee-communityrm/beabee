import SegmentService from "@core/services/SegmentService";
import Segment from "@models/Segment";
import { GetSegmentData, GetSegmentWith } from "./interface";

export async function convertSegmentToData(
  segment: Segment,
  opts: { with?: GetSegmentWith[] }
): Promise<GetSegmentData> {
  const contactCount = opts.with?.includes(GetSegmentWith.contactCount)
    ? await SegmentService.getSegmentMemberCount(segment)
    : undefined;

  return {
    id: segment.id,
    name: segment.name,
    description: segment.description,
    ruleGroup: segment.ruleGroup,
    order: segment.order,
    ...(contactCount !== undefined && { contactCount })
  };
}

export * from "./interface";

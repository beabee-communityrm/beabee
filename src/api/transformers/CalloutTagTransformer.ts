import {
  CalloutTagFilterName,
  RoleType,
  calloutTagFilters
} from "@beabee/beabee-common";

import { GetCalloutTagDto } from "@api/dto/CalloutTagDto";

import CalloutTag from "@models/CalloutTag";

import { BaseTransformer } from "./BaseTransformer";

class CalloutTagTransformer extends BaseTransformer<
  CalloutTag,
  GetCalloutTagDto,
  CalloutTagFilterName
> {
  protected model = CalloutTag;
  protected filters = calloutTagFilters;

  protected allowedRoles: RoleType[] = ["admin"];

  convert(tag: CalloutTag): GetCalloutTagDto {
    return {
      id: tag.id,
      name: tag.name
    };
  }
}

export default new CalloutTagTransformer();

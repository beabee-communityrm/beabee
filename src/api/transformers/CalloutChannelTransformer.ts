import {
  CalloutChannelFilterName,
  RoleType,
  calloutChannelFilters
} from "@beabee/beabee-common";
import { TransformPlainToInstance } from "class-transformer";

import { GetCalloutChannelDto } from "@api/dto/CalloutChannelDto";

import CalloutChannelModel from "@models/CalloutChannel";

import { BaseTransformer } from "./BaseTransformer";

class CalloutChannelTransformer extends BaseTransformer<
  CalloutChannelModel,
  GetCalloutChannelDto,
  CalloutChannelFilterName
> {
  protected model = CalloutChannelModel;
  protected filters = calloutChannelFilters;

  protected allowedRoles: RoleType[] = ["admin"];

  @TransformPlainToInstance(GetCalloutChannelDto)
  convert(tag: CalloutChannelModel): GetCalloutChannelDto {
    return {
      id: tag.id,
      name: tag.name
    };
  }
}

export default new CalloutChannelTransformer();

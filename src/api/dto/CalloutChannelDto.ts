import { IsIn, IsString } from "class-validator";
import { CalloutChannel } from "@beabee/beabee-common";

import { GetPaginatedQuery } from "@api/dto/BaseDto";

export class GetCalloutChannelDto {
  @IsString()
  id!: string;

  @IsString()
  name!: CalloutChannel;
}

export class CreateCalloutChannelDto {
  @IsString()
  name!: CalloutChannel;

  @IsString()
  description!: string;
}

export class ListCalloutChannelsDto extends GetPaginatedQuery {
  @IsIn(["id", "name"])
  sort?: string;
}

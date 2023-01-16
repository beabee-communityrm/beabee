import { Paginated } from "@beabee/beabee-common";
import {
  CurrentUser,
  Get,
  JsonController,
  QueryParams
} from "routing-controllers";

import {
  GetCalloutResponseData,
  GetCalloutResponsesQuery
} from "@api/data/CalloutResponseData";

import Contact from "@models/Contact";

@JsonController("/callout-response")
export class CalloutResponseController {
  @Get("/")
  getCalloutResponses(
    @CurrentUser() contact: Contact,
    @QueryParams() query: GetCalloutResponsesQuery
  ): Promise<Paginated<GetCalloutResponseData>> {
    return [];
  }
}

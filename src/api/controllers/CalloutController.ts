import { Get, JsonController } from "routing-controllers";

import Poll from "@models/Poll";

@JsonController("/callout")
export class CalloutController {
  @Get("/")
  async getCallouts(): Promise<Poll[]> {
    return [];
  }
}

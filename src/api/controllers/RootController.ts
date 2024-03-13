import { Get, JsonController, OnUndefined } from "routing-controllers";

@JsonController("/")
export class RootController {
  @Get("/")
  @OnUndefined(201)
  get(): undefined {}
}

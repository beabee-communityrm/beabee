import Content from "@models/Content";
import { Get, JsonController, Param } from "routing-controllers";
import { getRepository } from "typeorm";

@JsonController("/content")
export class ContentController {
  @Get("/:id")
  async getId(@Param("id") id: string): Promise<object | undefined> {
    return (await getRepository(Content).findOne(id))?.data;
  }
}

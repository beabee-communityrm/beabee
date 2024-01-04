import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Params,
  Patch,
  Post,
  QueryParams
} from "routing-controllers";

import { getRepository } from "@core/database";

import Contact from "@models/Contact";
import Notice from "@models/Notice";

import PartialBody from "@api/decorators/PartialBody";
import {
  CreateNoticeDto,
  GetNoticeDto,
  ListNoticesDto
} from "@api/dto/NoticeDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import { UUIDParams } from "@api/params/UUIDParams";
import NoticeTransformer from "@api/transformers/NoticeTransformer";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(
    @CurrentUser() caller: Contact,
    @QueryParams() query: ListNoticesDto
  ): Promise<PaginatedDto<GetNoticeDto>> {
    return await NoticeTransformer.fetch(caller, query);
  }

  @Get("/:id")
  async getNotice(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParams
  ): Promise<GetNoticeDto | undefined> {
    return await NoticeTransformer.fetchOneById(caller, id);
  }

  @Post("/")
  @Authorized("admin")
  async createNotice(@Body() data: CreateNoticeDto): Promise<GetNoticeDto> {
    const notice = await getRepository(Notice).save(data);
    return NoticeTransformer.convert(notice);
  }

  @Patch("/:id")
  @Authorized("admin")
  async updateNotice(
    @CurrentUser() caller: Contact,
    @Params() { id }: UUIDParams,
    @PartialBody() data: CreateNoticeDto
  ): Promise<GetNoticeDto | undefined> {
    await getRepository(Notice).update(id, data);
    return await NoticeTransformer.fetchOneById(caller, id);
  }

  @OnUndefined(204)
  @Delete("/:id")
  @Authorized("admin")
  async deleteNotice(@Params() { id }: UUIDParams) {
    const result = await getRepository(Notice).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

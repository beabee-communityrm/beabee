import { Paginated } from "@beabee/beabee-common";
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

import { UUIDParam } from "@api/data";
import PartialBody from "@api/decorators/PartialBody";
import {
  CreateNoticeDto,
  GetNoticeDto,
  QueryNoticeDto
} from "@api/dto/NoticeDto";
import NoticeTransformer from "@api/transformers/NoticeTransformer";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(
    @CurrentUser() contact: Contact,
    @QueryParams() query: QueryNoticeDto
  ): Promise<Paginated<GetNoticeDto>> {
    return await NoticeTransformer.fetch(query, contact);
  }

  @Get("/:id")
  async getNotice(
    @CurrentUser() contact: Contact,
    @Params() { id }: UUIDParam
  ): Promise<GetNoticeDto | undefined> {
    return await NoticeTransformer.fetchOneById(id, contact);
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
    @CurrentUser() contact: Contact,
    @Params() { id }: UUIDParam,
    @PartialBody() data: CreateNoticeDto
  ): Promise<GetNoticeDto | undefined> {
    await getRepository(Notice).update(id, data);
    return await NoticeTransformer.fetchOneById(id, contact);
  }

  @OnUndefined(204)
  @Delete("/:id")
  @Authorized("admin")
  async deleteNotice(@Params() { id }: UUIDParam) {
    const result = await getRepository(Notice).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

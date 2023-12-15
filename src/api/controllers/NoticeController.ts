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
import NoticeTransformer from "@api/transformers/notice/notice.transformer";
import {
  CreateNoticeData,
  GetNoticeData,
  NoticeQuery
} from "@api/transformers/notice/notice.data";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(
    @CurrentUser() contact: Contact,
    @QueryParams() query: NoticeQuery
  ): Promise<Paginated<GetNoticeData>> {
    return await NoticeTransformer.fetch(query, contact);
  }

  @Get("/:id")
  async getNotice(
    @CurrentUser() contact: Contact,
    @Params() { id }: UUIDParam
  ): Promise<GetNoticeData | undefined> {
    return await NoticeTransformer.fetchOneById(id, contact);
  }

  @Post("/")
  @Authorized("admin")
  async createNotice(@Body() data: CreateNoticeData): Promise<GetNoticeData> {
    const notice = await getRepository(Notice).save(data);
    return NoticeTransformer.convert(notice);
  }

  @Patch("/:id")
  @Authorized("admin")
  async updateNotice(
    @CurrentUser() contact: Contact,
    @Params() { id }: UUIDParam,
    @PartialBody() data: CreateNoticeData
  ): Promise<GetNoticeData | undefined> {
    await getRepository(Notice).update(id, data);
    return this.getNotice(contact, { id });
  }

  @OnUndefined(204)
  @Delete("/:id")
  @Authorized("admin")
  async deleteNotice(@Params() { id }: UUIDParam) {
    const result = await getRepository(Notice).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

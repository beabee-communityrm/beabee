import moment from "moment";
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
import { Brackets, createQueryBuilder, getRepository } from "typeorm";

import Notice from "@models/Notice";
import Member from "@models/Member";

import { UUIDParam } from "@api/data";
import {
  CreateNoticeData,
  GetNoticeData,
  GetNoticesQuery,
  NoticeStatus
} from "@api/data/NoticeData";
import PartialBody from "@api/decorators/PartialBody";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(
    @CurrentUser() member: Member,
    @QueryParams() query: GetNoticesQuery
  ): Promise<GetNoticeData[]> {
    const qb = createQueryBuilder(Notice, "notice");
    if (query.status === NoticeStatus.Open || !member.hasPermission("admin")) {
      qb.where("notice.enabled = TRUE").andWhere(
        new Brackets((qb) => {
          qb.where("notice.expires IS NULL").orWhere("notice.expires > :now", {
            now: moment.utc().toDate()
          });
        })
      );
    } else if (query.status === NoticeStatus.Finished) {
      qb.where("notice.enabled = FALSE").orWhere("notice.expires < :now", {
        now: moment.utc().toDate()
      });
    }
    return (await qb.getMany()).map(this.noticeToData);
  }

  @Get("/:id")
  async getNotice(
    @CurrentUser() member: Member,
    @Params() { id }: UUIDParam
  ): Promise<GetNoticeData | undefined> {
    const notice = await getRepository(Notice).findOne(id);
    if (notice && (notice.active || member.hasPermission("admin"))) {
      return this.noticeToData(notice);
    }
  }

  @Post("/")
  @Authorized("admin")
  async createNotice(@Body() data: CreateNoticeData): Promise<GetNoticeData> {
    const notice = await getRepository(Notice).save(data);
    return this.noticeToData(notice);
  }

  @Patch("/:id")
  @Authorized("admin")
  async updateNotice(
    @CurrentUser() member: Member,
    @Params() { id }: UUIDParam,
    @PartialBody() data: CreateNoticeData
  ): Promise<GetNoticeData | undefined> {
    await getRepository(Notice).update(id, data);
    return this.getNotice(member, { id });
  }

  @OnUndefined(204)
  @Delete("/:id")
  @Authorized("admin")
  async deleteNotice(@Params() { id }: UUIDParam) {
    const result = await getRepository(Notice).delete(id);
    if (!result.affected) throw new NotFoundError();
  }

  private noticeToData(notice: Notice): GetNoticeData {
    return {
      id: notice.id,
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
      name: notice.name,
      text: notice.text,
      buttonText: notice.buttonText,
      enabled: notice.enabled,
      ...(notice.expires !== null && { expires: notice.expires }),
      ...(notice.url !== null && { url: notice.url }),
      status: notice.active ? NoticeStatus.Open : NoticeStatus.Finished
    };
  }
}

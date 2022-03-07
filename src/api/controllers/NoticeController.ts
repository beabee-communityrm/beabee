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
import { Brackets, getRepository } from "typeorm";

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
import { fetchPaginated, Paginated } from "@api/utils/pagination";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(
    @CurrentUser() member: Member,
    @QueryParams() query: GetNoticesQuery
  ): Promise<Paginated<GetNoticeData>> {
    const authedQuery: GetNoticesQuery = member.hasPermission("admin")
      ? query
      : {
          ...query,
          rules: {
            condition: "AND",
            rules: [
              // Non-admins can only see open notices
              { field: "status", operator: "equal", value: NoticeStatus.Open },
              ...(query.rules ? [query.rules] : [])
            ]
          }
        };

    const results = await fetchPaginated(Notice, authedQuery, (qb) => qb, {
      status: (rule, qb, suffix) => {
        if (rule.operator !== "equal") return;

        const now = "now" + suffix;

        if (rule.value === NoticeStatus.Open) {
          qb.where("item.enabled = TRUE").andWhere(
            new Brackets((qb) => {
              qb.where("item.expires IS NULL").orWhere(
                `item.expires > :${now}`
              );
            })
          );
        } else if (rule.value === NoticeStatus.Finished) {
          qb.where("item.enabled = FALSE").orWhere(`item.expires < :${now}`);
        }

        return {
          now: moment.utc().toDate()
        };
      }
    });

    return {
      ...results,
      items: results.items.map(this.noticeToData)
    };
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

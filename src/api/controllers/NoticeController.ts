import { ItemStatus, noticeFilters } from "@beabee/beabee-common";
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
import { getRepository } from "typeorm";

import Member from "@models/Member";
import Notice from "@models/Notice";

import { UUIDParam } from "@api/data";
import { CreateNoticeData, GetNoticeData } from "@api/data/NoticeData";
import {
  fetchPaginated,
  GetPaginatedQuery,
  mergeRules,
  Paginated,
  statusField
} from "@api/data/PaginatedData";

import PartialBody from "@api/decorators/PartialBody";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(
    @CurrentUser() member: Member,
    @QueryParams() query: GetPaginatedQuery
  ): Promise<Paginated<GetNoticeData>> {
    const authedQuery = mergeRules(query, [
      // Non-admins can only see open notices
      !member.hasPermission("admin") && {
        field: "status",
        operator: "equal",
        value: [ItemStatus.Open]
      }
    ]);
    const results = await fetchPaginated(
      Notice,
      noticeFilters,
      authedQuery,
      member,
      { status: statusField }
    );

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
      ...(notice.starts !== null && { starts: notice.starts }),
      ...(notice.expires !== null && { expires: notice.expires }),
      ...(notice.buttonText !== null && { buttonText: notice.buttonText }),
      ...(notice.url !== null && { url: notice.url }),
      status: notice.status
    };
  }
}

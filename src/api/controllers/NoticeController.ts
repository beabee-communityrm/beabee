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

import { getRepository } from "@core/database";

import Contact from "@models/Contact";
import Notice from "@models/Notice";

import { UUIDParam } from "@api/data";
import {
  CreateNoticeData,
  GetNoticeData,
  GetNoticesQuery
} from "@api/data/NoticeData";
import {
  fetchPaginated,
  mergeRules,
  Paginated,
  statusFieldHandler
} from "@api/data/PaginatedData";

import PartialBody from "@api/decorators/PartialBody";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(
    @CurrentUser() contact: Contact,
    @QueryParams() query: GetNoticesQuery
  ): Promise<Paginated<GetNoticeData>> {
    const authedQuery = {
      ...query,
      rules: mergeRules([
        query.rules,
        // Non-admins can only see open notices
        !contact.hasRole("admin") && {
          field: "status",
          operator: "equal",
          value: [ItemStatus.Open]
        }
      ])
    };

    const results = await fetchPaginated(
      Notice,
      noticeFilters,
      authedQuery,
      contact,
      { status: statusFieldHandler }
    );

    return {
      ...results,
      items: results.items.map(this.noticeToData)
    };
  }

  @Get("/:id")
  async getNotice(
    @CurrentUser() contact: Contact,
    @Params() { id }: UUIDParam
  ): Promise<GetNoticeData | undefined> {
    const notice = await getRepository(Notice).findOneBy({ id });
    if (notice && (notice.active || contact.hasRole("admin"))) {
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

  private noticeToData(notice: Notice): GetNoticeData {
    return {
      id: notice.id,
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
      name: notice.name,
      text: notice.text,
      starts: notice.starts,
      expires: notice.expires,
      status: notice.status,
      ...(notice.buttonText !== null && { buttonText: notice.buttonText }),
      ...(notice.url !== null && { url: notice.url })
    };
  }
}

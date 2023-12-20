import {
  ItemStatus,
  NoticeFilterName,
  PaginatedQuery,
  noticeFilters
} from "@beabee/beabee-common";

import { BaseTransformer } from "@api/transformers/BaseTransformer";
import { mergeRules } from "@api/data/PaginatedData";
import { GetNoticeDto, ListNoticesDto } from "@api/dto/NoticeDto";

import Contact from "@models/Contact";
import Notice from "@models/Notice";

export class NoticeTransformer extends BaseTransformer<
  Notice,
  GetNoticeDto,
  NoticeFilterName
> {
  model = Notice;
  filters = noticeFilters;

  convert(notice: Notice): GetNoticeDto {
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

  protected transformQuery(
    query: ListNoticesDto,
    runner: Contact | undefined
  ): ListNoticesDto {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        // Non-admins can only see open notices
        !runner?.hasRole("admin") && {
          field: "status",
          operator: "equal",
          value: [ItemStatus.Open]
        }
      ])
    };
  }
}

export default new NoticeTransformer();

import { ItemStatus, noticeFilters } from "@beabee/beabee-common";

import { Transformer } from "@api/transformers";
import { mergeRules } from "@api/data/PaginatedData";

import Contact from "@models/Contact";
import Notice from "@models/Notice";

import { GetNoticeData, NoticeQuery } from "./notice.data";

export class NoticeTransformer extends Transformer<
  Notice,
  GetNoticeData,
  NoticeQuery
> {
  model = Notice;
  filters = noticeFilters;

  convert(notice: Notice): GetNoticeData {
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
    query: NoticeQuery,
    runner: Contact | undefined
  ): NoticeQuery {
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

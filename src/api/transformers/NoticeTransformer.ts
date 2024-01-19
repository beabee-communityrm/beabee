import {
  ItemStatus,
  NoticeFilterName,
  noticeFilters
} from "@beabee/beabee-common";

import { BaseTransformer } from "@api/transformers/BaseTransformer";
import { GetNoticeDto, ListNoticesDto } from "@api/dto/NoticeDto";
import { mergeRules, statusFilterHandler } from "@api/utils/rules";

import Notice from "@models/Notice";

import { AuthInfo } from "@type/auth-info";

export class NoticeTransformer extends BaseTransformer<
  Notice,
  GetNoticeDto,
  NoticeFilterName
> {
  protected model = Notice;
  protected filters = noticeFilters;
  protected filterHandlers = { status: statusFilterHandler };

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

  protected transformQuery<T extends ListNoticesDto>(
    query: T,
    auth: AuthInfo | undefined
  ): T {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        // Non-admins can only see open notices
        !auth?.roles.includes("admin") && {
          field: "status",
          operator: "equal",
          value: [ItemStatus.Open]
        }
      ])
    };
  }
}

export default new NoticeTransformer();

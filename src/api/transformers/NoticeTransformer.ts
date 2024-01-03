import {
  ItemStatus,
  NoticeFilterName,
  noticeFilters
} from "@beabee/beabee-common";
import { TransformPlainToInstance } from "class-transformer";

import { BaseTransformer } from "@api/transformers/BaseTransformer";
import { GetNoticeDto, ListNoticesDto } from "@api/dto/NoticeDto";
import { mergeRules, statusFilterHandler } from "@api/utils/rules";

import Contact from "@models/Contact";
import Notice from "@models/Notice";

export class NoticeTransformer extends BaseTransformer<
  Notice,
  GetNoticeDto,
  NoticeFilterName
> {
  protected model = Notice;
  protected filters = noticeFilters;
  protected filterHandlers = { status: statusFilterHandler };

  @TransformPlainToInstance(GetNoticeDto)
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
    caller: Contact | undefined
  ): T {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        // Non-admins can only see open notices
        !caller?.hasRole("admin") && {
          field: "status",
          operator: "equal",
          value: [ItemStatus.Open]
        }
      ])
    };
  }
}

export default new NoticeTransformer();

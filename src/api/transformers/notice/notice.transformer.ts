import { ItemStatus, noticeFilters } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import { IsDate, IsIn, IsOptional, IsString } from "class-validator";

import { Transformer } from "@api/transformers";
import { GetPaginatedQuery, mergeRules } from "@api/data/PaginatedData";

import Contact from "@models/Contact";
import Notice from "@models/Notice";

export class NoticeTransformer extends Transformer<
  Notice,
  NoticeTransformer.GetData,
  NoticeTransformer.Query
> {
  model = Notice;
  filters = noticeFilters;

  convert(notice: Notice): NoticeTransformer.GetData {
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
    query: NoticeTransformer.Query,
    runner: Contact | undefined
  ): NoticeTransformer.Query {
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

export namespace NoticeTransformer {
  interface BaseData {
    name: string;
    starts: Date | null;
    expires: Date | null;
    text: string;
    buttonText?: string;
    url?: string;
  }

  const sortFields = ["createdAt", "updatedAt", "name", "expires"] as const;

  export class Query extends GetPaginatedQuery {
    @IsIn(sortFields)
    sort?: string;
  }

  export interface GetData extends BaseData {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: ItemStatus;
  }

  export class CreateData implements BaseData {
    @IsString()
    name!: string;

    @Type(() => Date)
    @IsDate()
    @IsOptional()
    starts!: Date | null;

    @Type(() => Date)
    @IsDate()
    @IsOptional()
    expires!: Date | null;

    @IsString()
    text!: string;

    @IsString()
    @IsOptional()
    buttonText?: string;

    @IsString()
    @IsOptional()
    url?: string;
  }
}

export default new NoticeTransformer();

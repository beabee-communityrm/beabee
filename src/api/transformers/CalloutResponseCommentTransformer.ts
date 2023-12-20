import {
  CalloutResponseCommentFilterName,
  Paginated,
  calloutResponseCommentFilters
} from "@beabee/beabee-common";
import { SelectQueryBuilder } from "typeorm";

import { BaseTransformer } from "./BaseTransformer";

import {
  GetCalloutResponseCommentDto,
  QueryCalloutResponseCommentsDto
} from "@api/dto/CalloutResponseCommentDto";
import { convertContactToData, loadContactRoles } from "@api/data/ContactData";
import { mergeRules } from "@api/data/PaginatedData";

import CalloutResponseComment from "@models/CalloutResponseComment";
import Contact from "@models/Contact";

class CalloutResponseCommentTransformer extends BaseTransformer<
  CalloutResponseComment,
  GetCalloutResponseCommentDto,
  QueryCalloutResponseCommentsDto,
  CalloutResponseCommentFilterName
> {
  model = CalloutResponseComment;
  filters = calloutResponseCommentFilters;

  convert(comment: CalloutResponseComment): GetCalloutResponseCommentDto {
    return {
      id: comment.id,
      contact: convertContactToData(comment.contact),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      responseId: comment.responseId,
      text: comment.text
    };
  }

  protected transformQuery(
    query: QueryCalloutResponseCommentsDto,
    runner: Contact | undefined
  ): QueryCalloutResponseCommentsDto {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        !runner?.hasRole("admin") && {
          field: "contact",
          operator: "equal",
          value: ["me"]
        }
      ])
    };
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<CalloutResponseComment>,
    fieldPrefix: string
  ): void {
    qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact");
  }

  protected async modifyResult(
    result: Paginated<CalloutResponseComment>
  ): Promise<void> {
    await loadContactRoles(result.items.map((i) => i.contact));
  }
}

export default new CalloutResponseCommentTransformer();

import {
  CalloutResponseCommentFilterName,
  Paginated,
  calloutResponseCommentFilters
} from "@beabee/beabee-common";
import { SelectQueryBuilder } from "typeorm";

import { BaseTransformer } from "./BaseTransformer";

import {
  GetCalloutResponseCommentDto,
  ListCalloutResponseCommentsDto
} from "@api/dto/CalloutResponseCommentDto";
import { mergeRules } from "@api/data/PaginatedData";

import CalloutResponseComment from "@models/CalloutResponseComment";
import Contact from "@models/Contact";
import ContactTransformer, { loadContactRoles } from "./ContactTransformer";

class CalloutResponseCommentTransformer extends BaseTransformer<
  CalloutResponseComment,
  GetCalloutResponseCommentDto,
  CalloutResponseCommentFilterName
> {
  model = CalloutResponseComment;
  filters = calloutResponseCommentFilters;

  convert(comment: CalloutResponseComment): GetCalloutResponseCommentDto {
    return {
      id: comment.id,
      contact: ContactTransformer.convert(comment.contact),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      responseId: comment.responseId,
      text: comment.text
    };
  }

  protected transformQuery(
    query: ListCalloutResponseCommentsDto,
    caller: Contact | undefined
  ): ListCalloutResponseCommentsDto {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        !caller?.hasRole("admin") && {
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

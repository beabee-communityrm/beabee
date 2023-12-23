import {
  CalloutResponseCommentFilterName,
  Paginated,
  calloutResponseCommentFilters
} from "@beabee/beabee-common";
import { SelectQueryBuilder } from "typeorm";

import {
  GetCalloutResponseCommentDto,
  ListCalloutResponseCommentsDto
} from "@api/dto/CalloutResponseCommentDto";
import { BaseTransformer } from "@api/transformers/BaseTransformer";
import ContactTransformer, {
  loadContactRoles
} from "@api/transformers/ContactTransformer";
import { mergeRules } from "@api/utils/rules";

import CalloutResponseComment from "@models/CalloutResponseComment";
import Contact from "@models/Contact";

class CalloutResponseCommentTransformer extends BaseTransformer<
  CalloutResponseComment,
  GetCalloutResponseCommentDto,
  CalloutResponseCommentFilterName
> {
  protected model = CalloutResponseComment;
  protected filters = calloutResponseCommentFilters;

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

import {
  CalloutResponseCommentFilterName,
  calloutResponseCommentFilters
} from "@beabee/beabee-common";
import { TransformPlainToInstance } from "class-transformer";
import { SelectQueryBuilder } from "typeorm";

import {
  GetCalloutResponseCommentDto,
  ListCalloutResponseCommentsDto
} from "#api/dto/CalloutResponseCommentDto";
import { BaseTransformer } from "#api/transformers/BaseTransformer";
import ContactTransformer, {
  loadContactRoles
} from "#api/transformers/ContactTransformer";
import { mergeRules } from "#api/utils/rules";

import CalloutResponseComment from "#models/CalloutResponseComment";

import { AuthInfo } from "#type/auth-info";

class CalloutResponseCommentTransformer extends BaseTransformer<
  CalloutResponseComment,
  GetCalloutResponseCommentDto,
  CalloutResponseCommentFilterName
> {
  protected model = CalloutResponseComment;
  protected filters = calloutResponseCommentFilters;

  @TransformPlainToInstance(GetCalloutResponseCommentDto)
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

  protected transformQuery<T extends ListCalloutResponseCommentsDto>(
    query: T,
    auth: AuthInfo | undefined
  ): T {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        !auth?.roles.includes("admin") && {
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

  protected async modifyItems(
    comments: CalloutResponseComment[]
  ): Promise<void> {
    await loadContactRoles(comments.map((c) => c.contact));
  }
}

export default new CalloutResponseCommentTransformer();

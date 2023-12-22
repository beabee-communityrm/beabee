import {
  CalloutResponseFilterName,
  Paginated,
  PaginatedQuery,
  RoleType,
  calloutResponseFilters,
  getCalloutComponents,
  stringifyAnswer
} from "@beabee/beabee-common";
import { stringify } from "csv-stringify/sync";
import { format } from "date-fns";
import { In, SelectQueryBuilder } from "typeorm";

import { getRepository } from "@core/database";

import { GetExportQuery } from "@api/data/PaginatedData";
import { ExportCalloutResponseDto } from "@api/dto/CalloutResponseDto";
import { BaseTransformer } from "@api/transformers/BaseTransformer";
import { groupBy } from "@api/utils";

import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseComment from "@models/CalloutResponseComment";
import Contact from "@models/Contact";

function commentText(comment: CalloutResponseComment) {
  const date = format(comment.createdAt, "Pp");
  return `${comment.contact.fullname} (${date}): ${comment.text}`;
}

class CalloutResponseExporter extends BaseTransformer<
  CalloutResponse,
  ExportCalloutResponseDto,
  CalloutResponseFilterName,
  GetExportQuery
> {
  model = CalloutResponse;
  filters = calloutResponseFilters;

  allowedRoles: RoleType[] = ["admin"];

  convert(
    response: CalloutResponse,
    opts: GetExportQuery
  ): ExportCalloutResponseDto {
    const contact: [string, string, string, string] = response.contact
      ? [
          response.contact.firstname,
          response.contact.lastname,
          response.contact.fullname,
          response.contact.email
        ]
      : ["", "", response.guestName || "", response.guestEmail || ""];

    return [
      response.createdAt.toISOString(),
      response.number,
      response.bucket,
      response.tags.map((rt) => rt.tag.name).join(", "),
      response.assignee?.email || "",
      ...contact,
      !response.contact,
      response.comments?.map(commentText).join(", ") || "",
      ...components.map((c) =>
        stringifyAnswer(c, response.answers[c.slideId]?.[c.key])
      )
    ];
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<CalloutResponse>,
    fieldPrefix: string
  ): void {
    qb.orderBy(`${fieldPrefix}createdAt`, "ASC");
    qb.leftJoinAndSelect(`${fieldPrefix}assignee`, "assignee");
    qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact");
    qb.leftJoinAndSelect(`${fieldPrefix}tags`, "tags");
    qb.leftJoinAndSelect("tags.tag", "tag");
  }

  protected async modifyResult(
    result: Paginated<CalloutResponse>,
    query: GetExportQuery & PaginatedQuery,
    caller: Contact | undefined
  ): Promise<void> {
    // Fetch comments for filtered responses
    const comments = await getRepository(CalloutResponseComment).find({
      where: {
        responseId: In(result.items.map((response) => response.id))
      },
      relations: { contact: true },
      order: { createdAt: "ASC" }
    });

    const commentsByResponseId = groupBy(comments, (c) => c.responseId);

    for (const response of result.items) {
      const responseComments = commentsByResponseId[response.id];
      if (responseComments) {
        response.comments = responseComments;
      }
    }
  }

  async export(
    caller: Contact | undefined,
    query?: GetExportQuery
  ): Promise<[string, string]> {
    const result = await this.fetch(caller, { limit: -1, ...query });

    const exportName = `responses-${
      callout.title
    }_${new Date().toISOString()}.csv`;

    const components = getCalloutComponents(callout.formSchema).filter(
      (c) => c.input
    );

    const headers = [
      "Date",
      "Number",
      "Bucket",
      "Tags",
      "Assignee",
      "FirstName",
      "LastName",
      "FullName",
      "EmailAddress",
      "IsGuest",
      "Comments",
      ...components.map((c) => c.label || c.key)
    ];

    return [
      exportName,
      stringify([headers, ...result.items], {
        cast: { date: (d) => d.toISOString() }
      })
    ];
  }
}

export default new CalloutResponseExporter();

import {
  CalloutResponseFilterName,
  Paginated,
  PaginatedQuery,
  calloutResponseFilters
} from "@beabee/beabee-common";

import {
  GetCalloutResponseDto,
  GetCalloutResponseOptsDto,
  GetCalloutResponseWith,
  ListCalloutResponsesDto
} from "@api/dto/CalloutResponseDto";

import { BaseTransformer } from "@api/transformers/BaseTransformer";
import CalloutResponse from "@models/CalloutResponse";
import ContactTransformer, {
  loadContactRoles
} from "@api/transformers/ContactTransformer";
import CalloutTransformer from "@api/transformers/CalloutTransformer";
import CalloutResponseCommentTransformer from "@api/transformers/CalloutResponseCommentTransformer";
import CalloutTagTransformer from "@api/transformers/CalloutTagTransformer";
import Contact from "@models/Contact";
import { SelectQueryBuilder } from "typeorm";
import { createQueryBuilder } from "@core/database";
import CalloutResponseComment from "@models/CalloutResponseComment";
import CalloutResponseTag from "@models/CalloutResponseTag";
import { mergeRules } from "@api/data/PaginatedData";

class CalloutResponseTransformer extends BaseTransformer<
  CalloutResponse,
  GetCalloutResponseDto,
  CalloutResponseFilterName,
  GetCalloutResponseOptsDto
> {
  model = CalloutResponse;
  filters = calloutResponseFilters;

  convert(
    response: CalloutResponse,
    opts: GetCalloutResponseOptsDto
  ): GetCalloutResponseDto {
    return {
      id: response.id,
      number: response.number,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
      bucket: response.bucket,
      guestName: response.guestName,
      guestEmail: response.guestEmail,
      ...(opts.with?.includes(GetCalloutResponseWith.Answers) && {
        answers: response.answers
      }),
      ...(opts.with?.includes(GetCalloutResponseWith.Assignee) && {
        assignee:
          response.assignee && ContactTransformer.convert(response.assignee)
      }),
      ...(opts.with?.includes(GetCalloutResponseWith.Callout) && {
        callout: CalloutTransformer.convert(response.callout)
      }),
      ...(opts.with?.includes(GetCalloutResponseWith.Contact) && {
        contact:
          response.contact && ContactTransformer.convert(response.contact)
      }),
      ...(opts.with?.includes(GetCalloutResponseWith.LatestComment) && {
        latestComment:
          response.latestComment &&
          CalloutResponseCommentTransformer.convert(response.latestComment)
      }),
      ...(opts.with?.includes(GetCalloutResponseWith.Tags) &&
        response.tags && {
          tags: response.tags.map((rt) => CalloutTagTransformer.convert(rt.tag))
        })
    };
  }

  protected transformQuery(
    query: GetCalloutResponseOptsDto & PaginatedQuery,
    caller: Contact | undefined
  ): GetCalloutResponseOptsDto & PaginatedQuery {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        // Non admins can only see their own responses
        !caller?.hasRole("admin") && {
          field: "contact",
          operator: "equal",
          value: ["me"]
        }
        // Only load responses for the given callout
        // !!callout && {
        //   field: "callout",
        //   operator: "equal",
        //   value: [callout.slug]
        // }
      ])
    };
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<CalloutResponse>,
    fieldPrefix: string,
    query: ListCalloutResponsesDto
  ): void {
    if (query.with?.includes(GetCalloutResponseWith.Assignee)) {
      qb.leftJoinAndSelect(`${fieldPrefix}assignee`, "assignee");
    }
    if (query.with?.includes(GetCalloutResponseWith.Callout)) {
      qb.innerJoinAndSelect(`${fieldPrefix}callout`, "callout");
    }
    if (query.with?.includes(GetCalloutResponseWith.Contact)) {
      qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact");
    }
  }

  protected async modifyResult(
    result: Paginated<CalloutResponse>,
    query: ListCalloutResponsesDto
  ): Promise<void> {
    if (result.items.length > 0) {
      const responseIds = result.items.map((i) => i.id);

      if (query.with?.includes(GetCalloutResponseWith.LatestComment)) {
        const comments = await createQueryBuilder(CalloutResponseComment, "c")
          .distinctOn(["c.response"])
          .where("c.response IN (:...ids)", { ids: responseIds })
          .leftJoinAndSelect("c.contact", "contact")
          .orderBy({ "c.response": "ASC", "c.createdAt": "DESC" })
          .getMany();

        for (const item of result.items) {
          item.latestComment =
            comments.find((c) => c.responseId === item.id) || null;
        }
      }

      // Load contact roles after to ensure offset/limit work
      const contacts = result.items
        .flatMap((item) => [
          item.contact,
          item.assignee,
          item.latestComment?.contact
        ])
        .filter((c): c is Contact => !!c);
      await loadContactRoles(contacts);

      if (query.with?.includes(GetCalloutResponseWith.Tags)) {
        // Load tags after to ensure offset/limit work
        const responseTags = await createQueryBuilder(CalloutResponseTag, "rt")
          .where("rt.response IN (:...ids)", { ids: responseIds })
          .innerJoinAndSelect("rt.tag", "tag")
          .getMany();

        for (const item of result.items) {
          item.tags = responseTags.filter((rt) => rt.responseId === item.id);
        }
      }
    }
  }
}

export default new CalloutResponseTransformer();

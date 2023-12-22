import { Paginated } from "@beabee/beabee-common";

import {
  GetCalloutResponseDto,
  GetCalloutResponseOptsDto,
  GetCalloutResponseWith,
  ListCalloutResponsesDto
} from "@api/dto/CalloutResponseDto";

import CalloutResponse from "@models/CalloutResponse";
import ContactTransformer, {
  loadContactRoles
} from "@api/transformers/ContactTransformer";
import CalloutTransformer from "@api/transformers/CalloutTransformer";
import CalloutResponseCommentTransformer from "@api/transformers/CalloutResponseCommentTransformer";
import CalloutTagTransformer from "@api/transformers/CalloutTagTransformer";
import Contact from "@models/Contact";
import { SelectQueryBuilder } from "typeorm";
import { createQueryBuilder, getRepository } from "@core/database";
import CalloutResponseComment from "@models/CalloutResponseComment";
import CalloutResponseTag from "@models/CalloutResponseTag";
import Callout from "@models/Callout";
import NotFoundError from "@api/errors/NotFoundError";
import { BaseCalloutResponseTransformer } from "./BaseCalloutResponseTransformer";

export class CalloutResponseTransformer extends BaseCalloutResponseTransformer<
  GetCalloutResponseDto,
  GetCalloutResponseOptsDto
> {
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

  async fetchForCallout(
    caller: Contact | undefined,
    calloutSlug: string,
    query: ListCalloutResponsesDto
  ): Promise<Paginated<GetCalloutResponseDto>> {
    const callout = await getRepository(Callout).findOneBy({
      slug: calloutSlug
    });
    if (!callout) {
      throw new NotFoundError();
    }
    return await this.fetch(caller, { ...query, callout });
  }
}

export default new CalloutResponseTransformer();

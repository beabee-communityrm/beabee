import { Paginated } from "@beabee/beabee-common";
import { SelectQueryBuilder } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity.js";

import { createQueryBuilder, getRepository } from "@core/database";

import {
  BatchUpdateCalloutResponseDto,
  CreateCalloutResponseDto,
  GetCalloutResponseDto,
  GetCalloutResponseOptsDto,
  GetCalloutResponseWith,
  ListCalloutResponsesDto
} from "@api/dto/CalloutResponseDto";
import NotFoundError from "@api/errors/NotFoundError";
import ContactTransformer, {
  loadContactRoles
} from "@api/transformers/ContactTransformer";
import CalloutTransformer from "@api/transformers/CalloutTransformer";
import CalloutResponseCommentTransformer from "@api/transformers/CalloutResponseCommentTransformer";
import CalloutTagTransformer from "@api/transformers/CalloutTagTransformer";
import { BaseCalloutResponseTransformer } from "@api/transformers/BaseCalloutResponseTransformer";
import { batchUpdate } from "@api/utils/rules";

import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseComment from "@models/CalloutResponseComment";
import CalloutResponseTag from "@models/CalloutResponseTag";
import Contact from "@models/Contact";

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

  async update(
    caller: Contact | undefined,
    query: BatchUpdateCalloutResponseDto
  ): Promise<number> {
    const [filters, filterHandlers] = this.preFetch(caller, query);
    const query2 = this.transformQuery(query, caller);

    const { tagUpdates, responseUpdates } = getUpdateData(query2.updates);
    const result = await batchUpdate(
      this.model,
      filters,
      query2.rules,
      responseUpdates,
      caller,
      filterHandlers,
      (qb) => qb.returning(["id"])
    );

    const responses: { id: string }[] = result.raw;

    if (tagUpdates) {
      await updateResponseTags(
        responses.map((r) => r.id),
        tagUpdates
      );
    }

    return result.affected || -1;
  }

  async updateOneById(
    caller: Contact | undefined,
    id: string,
    updates: CreateCalloutResponseDto
  ): Promise<boolean> {
    const query: BatchUpdateCalloutResponseDto = {
      rules: {
        condition: "AND",
        rules: [{ field: this.modelIdField, operator: "equal", value: [id] }]
      },
      updates
    };
    const affected = await this.update(caller, query);
    return affected !== 0;
  }
}

function getUpdateData(data: Partial<CreateCalloutResponseDto>): {
  tagUpdates: string[] | undefined;
  responseUpdates: QueryDeepPartialEntity<CalloutResponse>;
} {
  const { tags: tagUpdates, assigneeId, ...otherUpdates } = data;
  return {
    tagUpdates,
    responseUpdates: {
      ...otherUpdates,
      ...(assigneeId !== undefined && {
        assignee: assigneeId ? { id: assigneeId } : null
      })
    }
  };
}

async function updateResponseTags(responseIds: string[], tagUpdates: string[]) {
  const addTags = tagUpdates
    .filter((tag) => tag.startsWith("+"))
    .flatMap((tag) =>
      responseIds.map((id) => ({ response: { id }, tag: { id: tag.slice(1) } }))
    );
  const removeTags = tagUpdates
    .filter((tag) => tag.startsWith("-"))
    .flatMap((tag) =>
      responseIds.map((id) => ({ response: { id }, tag: { id: tag.slice(1) } }))
    );

  if (addTags.length > 0) {
    await createQueryBuilder()
      .insert()
      .into(CalloutResponseTag)
      .values(addTags)
      .orIgnore()
      .execute();
  }
  if (removeTags.length > 0) {
    await createQueryBuilder()
      .delete()
      .from(CalloutResponseTag)
      .where(removeTags)
      .execute();
  }
}

export default new CalloutResponseTransformer();

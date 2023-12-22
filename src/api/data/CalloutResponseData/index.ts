import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { createQueryBuilder, getRepository } from "@core/database";

import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseTag from "@models/CalloutResponseTag";
import Contact from "@models/Contact";

import { batchUpdate } from "../PaginatedData";

import {
  BatchUpdateCalloutResponseData,
  CreateCalloutResponseDto
} from "../../dto/CalloutResponseDto";

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

export async function updateCalloutResponse(
  id: string,
  data: Partial<CreateCalloutResponseDto>
): Promise<void> {
  const { tagUpdates, responseUpdates } = getUpdateData(data);
  await getRepository(CalloutResponse).update(id, responseUpdates);
  if (tagUpdates) {
    await updateResponseTags([id], tagUpdates);
  }
}

export async function batchUpdateCalloutResponses(
  data: BatchUpdateCalloutResponseData,
  contact: Contact
): Promise<number> {
  return 1;
  // const [rules, filters, fieldHandlers] = await prepareQuery(
  //   data.rules,
  //   contact
  // );

  // const { tagUpdates, responseUpdates } = getUpdateData(data.updates);
  // const result = await batchUpdate(
  //   CalloutResponse,
  //   filters,
  //   rules,
  //   responseUpdates,
  //   contact,
  //   fieldHandlers,
  //   (qb) => qb.returning(["id"])
  // );

  // const responses = result.raw as { id: string }[];

  // if (tagUpdates) {
  //   await updateResponseTags(
  //     responses.map((r) => r.id),
  //     tagUpdates
  //   );
  // }

  // return result.affected || -1;
}

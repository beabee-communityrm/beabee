import {
  Paginated,
  calloutResponseFilters,
  FilterType,
  convertComponentsToFilters,
  RuleOperator,
  Filters,
  convertAnswers
} from "@beabee/beabee-common";
import Papa from "papaparse";
import { NotFoundError } from "routing-controllers";
import { createQueryBuilder, getRepository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseComment from "@models/CalloutResponseComment";
import CalloutResponseTag from "@models/CalloutResponseTag";
import Contact from "@models/Contact";

import { convertCalloutToData } from "../CalloutData";
import { convertTagToData } from "../CalloutTagData";
import { convertCommentToData } from "../CalloutResponseCommentData";
import { convertContactToData, loadUserRoles } from "../ContactData";
import {
  mergeRules,
  fetchPaginated,
  FieldHandler,
  batchUpdate,
  FieldHandlers,
  GetPaginatedRuleGroup
} from "../PaginatedData";

import {
  GetCalloutResponseWith,
  GetCalloutResponseData,
  GetCalloutResponsesQuery,
  GetCalloutResponseQuery,
  BatchUpdateCalloutResponseData,
  CreateCalloutResponseData
} from "./interface";

function convertResponseToData(
  response: CalloutResponse,
  _with?: GetCalloutResponseWith[]
): GetCalloutResponseData {
  return {
    id: response.id,
    number: response.number,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    bucket: response.bucket,
    ...(_with?.includes(GetCalloutResponseWith.Answers) && {
      answers: response.answers
    }),
    ...(_with?.includes(GetCalloutResponseWith.Assignee) && {
      assignee: response.assignee && convertContactToData(response.assignee)
    }),
    ...(_with?.includes(GetCalloutResponseWith.Callout) && {
      callout: convertCalloutToData(response.callout)
    }),
    ...(_with?.includes(GetCalloutResponseWith.Contact) && {
      contact: response.contact && convertContactToData(response.contact)
    }),
    ...(_with?.includes(GetCalloutResponseWith.LatestComment) && {
      latestComment:
        response.latestComment && convertCommentToData(response.latestComment)
    }),
    ...(_with?.includes(GetCalloutResponseWith.Tags) &&
      response.tags && {
        tags: response.tags.map((rt) => convertTagToData(rt.tag))
      })
  };
}

function getUpdateData(data: Partial<CreateCalloutResponseData>): {
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
  data: Partial<CreateCalloutResponseData>
): Promise<void> {
  const { tagUpdates, responseUpdates } = getUpdateData(data);
  await getRepository(CalloutResponse).update(id, responseUpdates);
  if (tagUpdates) {
    await updateResponseTags([id], tagUpdates);
  }
}

// Arrays are actually {a: true, b: false} type objects in answers
const answerArrayOperators: Partial<
  Record<RuleOperator, (field: string) => string>
> = {
  contains: (field) => `(${field} -> :a)::boolean`,
  not_contains: (field) => `NOT (${field} -> :a)::boolean`,
  is_empty: (field) => `NOT jsonb_path_exists(${field}, '$.* ? (@ == true)')`,
  is_not_empty: (field) => `jsonb_path_exists(${field}, '$.* ? (@ == true)')`
};

function answerField(type: FilterType, fieldPrefix: string): string {
  switch (type) {
    case "number":
      return `(${fieldPrefix}answers -> :p)::numeric`;
    case "boolean":
      return `(${fieldPrefix}answers -> :p)::boolean`;
    default:
      return `${fieldPrefix}answers ->> :p`;
  }
}

const answersFieldHandler: FieldHandler = (qb, args) => {
  if (args.type === "array") {
    const operatorFn = answerArrayOperators[args.operator];
    if (!operatorFn) {
      // Shouln't be able to happen as rule has been validated
      throw new Error("Invalid ValidatedRule");
    }
    qb.where(args.suffixFn(operatorFn(`${args.fieldPrefix}answers -> :p`)));
    // is_empty and is_not_empty need special treatment for JSONB values
  } else if (args.operator === "is_empty" || args.operator === "is_not_empty") {
    const operator = args.operator === "is_empty" ? "IN" : "NOT IN";
    qb.where(
      args.suffixFn(
        `COALESCE(item.answers -> :p, 'null') ${operator} ('null', '""')`
      )
    );
  } else {
    qb.where(args.whereFn(answerField(args.type, args.fieldPrefix)));
  }
};

const tagsFieldHandler: FieldHandler = (qb, args) => {
  const subQb = createQueryBuilder()
    .subQuery()
    .select("crt.responseId")
    .from(CalloutResponseTag, "crt");

  if (args.operator === "contains" || args.operator === "not_contains") {
    subQb.where(args.suffixFn("crt.tag = :a"));
  }

  const inOp =
    args.operator === "not_contains" || args.operator === "is_not_empty"
      ? "NOT IN"
      : "IN";

  qb.where(`${args.fieldPrefix}id ${inOp} ${subQb.getQuery()}`);
};

async function prepareQuery(
  ruleGroup: GetPaginatedRuleGroup | undefined,
  contact: Contact,
  calloutSlug?: string
): Promise<[GetPaginatedRuleGroup, Filters<string>, FieldHandlers<string>]> {
  const scopedRules = mergeRules([
    ruleGroup,
    // Non admins can only see their own responses
    !contact.hasRole("admin") && {
      field: "contact",
      operator: "equal",
      value: [contact.id]
    },
    // Only load responses for the given callout
    !!calloutSlug && {
      field: "callout",
      operator: "equal",
      value: [calloutSlug]
    }
  ]);

  let answerFilters, fieldHandlers;

  // If looking for responses for a particular callout then add answer filtering
  if (calloutSlug) {
    const callout = await getRepository(Callout).findOne(calloutSlug);
    if (!callout) {
      throw new NotFoundError();
    }

    answerFilters = convertComponentsToFilters(callout.formSchema.components);
    // All handled by the same field handler
    fieldHandlers = Object.fromEntries(
      Object.keys(answerFilters).map((field) => [field, answersFieldHandler])
    );
  }

  return [
    scopedRules,
    { ...calloutResponseFilters, ...answerFilters },
    { tags: tagsFieldHandler, ...fieldHandlers }
  ];
}

export async function exportCalloutResponses(
  ruleGroup: GetPaginatedRuleGroup | undefined,
  contact: Contact,
  calloutSlug: string
): Promise<[string, string]> {
  const callout = await getRepository(Callout).findOne(calloutSlug);
  if (!callout) {
    throw new NotFoundError();
  }

  const [rules, filters, fieldHandlers] = await prepareQuery(
    ruleGroup,
    contact,
    calloutSlug
  );

  const results = await fetchPaginated(
    CalloutResponse,
    filters,
    { rules, limit: -1 },
    contact,
    fieldHandlers,
    (qb, fieldPrefix) => {
      qb.orderBy(`${fieldPrefix}createdAt`, "ASC");
      qb.leftJoinAndSelect(`${fieldPrefix}assignee`, "assignee");
      qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact");
      qb.leftJoinAndSelect(`${fieldPrefix}tags`, "tags");
      qb.leftJoinAndSelect("tags.tag", "tag");
    }
  );

  const exportName = `responses-${
    callout.title
  }_${new Date().toISOString()}.csv`;

  const exportData = results.items.map((response) => {
    return {
      Date: response.createdAt,
      Number: response.number,
      Bucket: response.bucket,
      Tags: response.tags.map((rt) => rt.tag.name).join(", "),
      Assignee: response.assignee?.email || "",
      ...(response.contact
        ? {
            FirstName: response.contact.firstname,
            LastName: response.contact.lastname,
            FullName: response.contact.fullname,
            EmailAddress: response.contact.email
          }
        : {
            FirstName: "",
            LastName: "",
            FullName: response.guestName,
            EmailAddress: response.guestEmail
          }),
      IsGuest: !response.contact,
      ...convertAnswers(callout.formSchema, response.answers)
    };
  });
  return [exportName, Papa.unparse(exportData)];
}

export async function fetchPaginatedCalloutResponses(
  query: GetCalloutResponsesQuery,
  contact: Contact,
  calloutSlug?: string
): Promise<Paginated<GetCalloutResponseData>> {
  const [rules, filters, fieldHandlers] = await prepareQuery(
    query.rules,
    contact,
    calloutSlug
  );

  const results = await fetchPaginated(
    CalloutResponse,
    filters,
    { ...query, rules },
    contact,
    fieldHandlers,
    (qb, fieldPrefix) => {
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
  );

  if (results.items.length > 0) {
    const responseIds = results.items.map((i) => i.id);

    if (query.with?.includes(GetCalloutResponseWith.LatestComment)) {
      const comments = await createQueryBuilder(CalloutResponseComment, "c")
        .distinctOn(["c.response"])
        .where("c.response IN (:...ids)", { ids: responseIds })
        .leftJoinAndSelect("c.contact", "contact")
        .orderBy({ "c.response": "ASC", "c.createdAt": "DESC" })
        .getMany();

      for (const item of results.items) {
        item.latestComment =
          comments.find((c) => c.responseId === item.id) || null;
      }
    }

    // Load contact roles after to ensure offset/limit work
    const contacts = results.items
      .flatMap((item) => [
        item.contact,
        item.assignee,
        item.latestComment?.contact
      ])
      .filter((c) => !!c) as Contact[];
    await loadUserRoles(contacts);

    if (query.with?.includes(GetCalloutResponseWith.Tags)) {
      // Load tags after to ensure offset/limit work
      const responseTags = await createQueryBuilder(CalloutResponseTag, "rt")
        .where("rt.response IN (:...ids)", { ids: responseIds })
        .innerJoinAndSelect("rt.tag", "tag")
        .loadAllRelationIds({ relations: ["response"] })
        .getMany();

      for (const item of results.items) {
        item.tags = responseTags.filter(
          (rt) => (rt as any).response === item.id
        );
      }
    }
  }

  return {
    ...results,
    items: results.items.map((item) => convertResponseToData(item, query.with))
  };
}

export async function batchUpdateCalloutResponses(
  data: BatchUpdateCalloutResponseData,
  contact: Contact
): Promise<number> {
  const [rules, filters, fieldHandlers] = await prepareQuery(
    data.rules,
    contact
  );

  const { tagUpdates, responseUpdates } = getUpdateData(data.updates);
  const result = await batchUpdate(
    CalloutResponse,
    filters,
    rules,
    responseUpdates,
    contact,
    fieldHandlers,
    (qb) => qb.returning(["id"])
  );

  const responses = result.raw as { id: string }[];

  if (tagUpdates) {
    await updateResponseTags(
      responses.map((r) => r.id),
      tagUpdates
    );
  }

  return result.affected || -1;
}

export async function fetchCalloutResponse(
  id: string,
  query: GetCalloutResponseQuery,
  contact: Contact
): Promise<GetCalloutResponseData | undefined> {
  const a = await fetchPaginatedCalloutResponses(
    {
      ...query,
      limit: 1,
      rules: {
        condition: "AND",
        rules: [{ field: "id", operator: "equal", value: [id] }]
      }
    },
    contact
  );

  return a.items[0];
}

export * from "./interface";

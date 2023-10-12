import {
  Paginated,
  calloutResponseFilters,
  RuleOperator,
  Filters,
  stringifyAnswer,
  CalloutResponseAnswerFileUpload,
  CalloutResponseAnswerAddress,
  CalloutResponseAnswers,
  getCalloutFilters,
  CalloutFormSchema,
  CalloutResponseAnswer,
  getCalloutComponents
} from "@beabee/beabee-common";
import { stringify } from "csv-stringify/sync";
import { format } from "date-fns";
import { NotFoundError } from "routing-controllers";
import { In, createQueryBuilder, getRepository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import Callout, { CalloutResponseViewSchema } from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseComment from "@models/CalloutResponseComment";
import CalloutResponseTag from "@models/CalloutResponseTag";
import Contact from "@models/Contact";

import { groupBy } from "@api/utils";

import { convertCalloutToData } from "../CalloutData";
import { convertTagToData } from "../CalloutTagData";
import { convertCommentToData } from "../CalloutResponseCommentData";
import { convertContactToData, loadContactRoles } from "../ContactData";
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
  CreateCalloutResponseData,
  GetCalloutResponseMapData
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
    guestName: response.guestName,
    guestEmail: response.guestEmail,
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

function convertResponsesToMapData(
  formSchema: CalloutFormSchema,
  { titleProp, imageProp, map }: CalloutResponseViewSchema,
  responses: CalloutResponse[]
): GetCalloutResponseMapData[] {
  return responses.map((response) => {
    let title = "",
      images: CalloutResponseAnswer[] = [],
      address: CalloutResponseAnswer | undefined;

    const answers: CalloutResponseAnswers = Object.fromEntries(
      formSchema.slides.map((slide) => [slide.id, {}])
    );

    for (const component of getCalloutComponents(formSchema)) {
      // Skip components that shouldn't be displayed publicly
      if (component.adminOnly) {
        continue;
      }

      const answer = response.answers[component.slideId][component.key];
      if (answer) {
        answers[component.slideId][component.key] = answer;
      }

      // Extract title, address and image answers
      if (component.fullKey === titleProp) {
        title = stringifyAnswer(component, answer);
      }
      if (component.fullKey === map?.addressProp) {
        address = Array.isArray(answer) ? answer[0] : answer;
      }
      if (component.fullKey === imageProp) {
        images = Array.isArray(answer) ? answer : [answer];
      }
    }

    return {
      number: response.number,
      answers,
      title,
      photos: images as CalloutResponseAnswerFileUpload[], // TODO: ensure type?
      ...(address && {
        address: address as CalloutResponseAnswerAddress // TODO: ensure type?
      })
    };
  });
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

const individualAnswerFieldHandler: FieldHandler = (qb, args) => {
  const answerField = `${args.fieldPrefix}answers -> :s -> :k`;

  if (args.type === "array") {
    const operatorFn = answerArrayOperators[args.operator];
    if (!operatorFn) {
      // Shouln't be able to happen as rule has been validated
      throw new Error("Invalid ValidatedRule");
    }
    qb.where(args.suffixFn(operatorFn(answerField)));
    // is_empty and is_not_empty need special treatment for JSONB values
  } else if (args.operator === "is_empty" || args.operator === "is_not_empty") {
    const operator = args.operator === "is_empty" ? "IN" : "NOT IN";
    qb.where(
      args.suffixFn(
        `COALESCE(${answerField}, 'null') ${operator} ('null', '""')`
      )
    );
  } else if (args.type === "number" || args.type === "boolean") {
    const cast = args.type === "number" ? "numeric" : "boolean";
    qb.where(args.whereFn(`(${answerField})::${cast}`));
  } else {
    // Extract as text instead of JSONB (note ->> instead of ->)
    qb.where(args.whereFn(`${args.fieldPrefix}answers -> :s ->> :k`));
  }

  const [_, slideId, answerKey] = args.field.split(".");
  return {
    s: slideId,
    k: answerKey
  };
};

const calloutResponseFieldHandlers: FieldHandlers<string> = {
  answers: (qb, args) => {
    qb.where(
      args.whereFn(`(
        SELECT string_agg(answer.value, '')
        FROM jsonb_each(${args.fieldPrefix}answers) AS slide, jsonb_each_text(slide.value) AS answer
      )`)
    );
  },
  tags: (qb, args) => {
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
  }
};

function prepareFilters(
  callout?: Callout
): [Filters<string>, FieldHandlers<string>] {
  let answerFilters, answerFieldHandlers;

  // If looking for responses for a particular callout then add answer filtering
  if (callout) {
    answerFilters = getCalloutFilters(callout.formSchema);
    // All handled by the same field handler
    answerFieldHandlers = Object.fromEntries(
      Object.keys(answerFilters).map((field) => [
        field,
        individualAnswerFieldHandler
      ])
    );
  }

  return [
    { ...calloutResponseFilters, ...answerFilters },
    { ...calloutResponseFieldHandlers, ...answerFieldHandlers }
  ];
}

async function prepareQuery(
  ruleGroup: GetPaginatedRuleGroup | undefined,
  contact: Contact,
  callout?: Callout
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
    !!callout && {
      field: "callout",
      operator: "equal",
      value: [callout.slug]
    }
  ]);

  return [scopedRules, ...prepareFilters(callout)];
}

function commentText(comment: CalloutResponseComment) {
  const date = format(comment.createdAt, "Pp");
  return `${comment.contact.fullname} (${date}): ${comment.text}`;
}

export async function exportCalloutResponses(
  ruleGroup: GetPaginatedRuleGroup | undefined,
  contact: Contact,
  callout: Callout
): Promise<[string, string]> {
  const [rules, filters, fieldHandlers] = await prepareQuery(
    ruleGroup,
    contact,
    callout
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

  // Fetch comments for filtered responses
  const comments = await getRepository(CalloutResponseComment).find({
    where: {
      responseId: In(results.items.map((response) => response.id))
    },
    relations: ["contact"],
    order: { createdAt: "ASC" }
  });
  const commentsByResponseId = groupBy(comments, (c) => c.responseId);

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

  const rows = results.items.map((response) => {
    const comments = commentsByResponseId[response.id] || [];

    return [
      response.createdAt,
      response.number,
      response.bucket,
      response.tags.map((rt) => rt.tag.name).join(", "),
      response.assignee?.email || "",
      ...(response.contact
        ? [
            response.contact.firstname,
            response.contact.lastname,
            response.contact.fullname,
            response.contact.email
          ]
        : ["", "", response.guestName, response.guestEmail]),
      !response.contact,
      comments.map(commentText).join(", "),
      ...components.map((c) =>
        stringifyAnswer(c, response.answers[c.slideId][c.key])
      )
    ];
  });

  return [
    exportName,
    stringify([headers, ...rows], { cast: { date: (d) => d.toISOString() } })
  ];
}

export async function fetchPaginatedCalloutResponses(
  query: GetCalloutResponsesQuery,
  contact: Contact,
  callout?: Callout
): Promise<Paginated<GetCalloutResponseData>> {
  const [rules, filters, fieldHandlers] = await prepareQuery(
    query.rules,
    contact,
    callout
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
    await loadContactRoles(contacts);

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

export async function fetchPaginatedCalloutResponsesForMap(
  query: GetCalloutResponsesQuery,
  contact: Contact | undefined,
  callout: Callout
): Promise<Paginated<GetCalloutResponseMapData>> {
  const responseViewSchema = callout.responseViewSchema;
  if (!responseViewSchema) {
    throw new NotFoundError();
  }

  const [filters, fieldHandlers] = prepareFilters(callout);
  const scopedRules = mergeRules([
    query.rules,
    // Only load responses for the given callout
    {
      field: "callout",
      operator: "equal",
      value: [callout.slug]
    },
    {
      condition: "OR",
      rules: responseViewSchema.buckets.map((bucket) => ({
        field: "bucket",
        operator: "equal",
        value: [bucket]
      }))
    }
  ]);

  const results = await fetchPaginated(
    CalloutResponse,
    filters,
    { limit: 2000, ...query, rules: scopedRules },
    contact,
    fieldHandlers
  );

  return {
    ...results,
    items: convertResponsesToMapData(
      callout.formSchema,
      responseViewSchema,
      results.items
    )
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

import {
  Paginated,
  calloutResponseFilters,
  FilterType,
  convertComponentsToFilters,
  RuleOperator,
  Filters
} from "@beabee/beabee-common";
import { NotFoundError } from "routing-controllers";
import { createQueryBuilder, FindConditions, getRepository } from "typeorm";

import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseTag from "@models/CalloutResponseTag";
import Contact from "@models/Contact";

import { convertCalloutToData } from "../CalloutData";
import { convertTagToData } from "../CalloutTagData";
import { convertContactToData } from "../ContactData";
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

export function convertResponseToData(
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
    ...(_with?.includes(GetCalloutResponseWith.Callout) && {
      callout: convertCalloutToData(response.callout)
    }),
    ...(_with?.includes(GetCalloutResponseWith.Contact) && {
      contact: response.contact && convertContactToData(response.contact)
    }),
    ...(_with?.includes(GetCalloutResponseWith.Tags) &&
      response.tags && {
        tags: response.tags.map((rt) => convertTagToData(rt.tag))
      })
  };
}

export async function fetchCalloutResponse(
  id: string,
  query: GetCalloutResponseQuery,
  contact: Contact
): Promise<GetCalloutResponseData | undefined> {
  const response = await getRepository(CalloutResponse).findOne({
    where: {
      id,
      // Non-admins can only see their own responses
      ...(!contact.hasRole("admin") && { contact })
    },
    relations: [
      ...(query.with?.includes(GetCalloutResponseWith.Callout)
        ? ["callout"]
        : []),
      ...(query.with?.includes(GetCalloutResponseWith.Contact)
        ? ["contact", "contact.roles"]
        : []),
      ...(query.with?.includes(GetCalloutResponseWith.Tags)
        ? ["tags", "tags.tag"]
        : [])
    ]
  });

  return response && convertResponseToData(response, query.with);
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
  const { tags: tagUpdates, ...updates } = data;
  await getRepository(CalloutResponse).update(id, updates);
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
      if (query.with?.includes(GetCalloutResponseWith.Callout)) {
        qb.innerJoinAndSelect(`${fieldPrefix}callout`, "callout");
      }
      if (query.with?.includes(GetCalloutResponseWith.Contact)) {
        qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact");
        qb.leftJoinAndSelect("contact.roles", "roles");
      }
    }
  );

  if (
    results.items.length > 0 &&
    query.with?.includes(GetCalloutResponseWith.Tags)
  ) {
    // Load tags after to ensure offset/limit work
    const responseTags = await createQueryBuilder(CalloutResponseTag, "rt")
      .where("rt.response IN (:...ids)", {
        ids: results.items.map((i) => i.id)
      })
      .innerJoinAndSelect("rt.tag", "tag")
      .loadAllRelationIds({ relations: ["response"] })
      .getMany();

    for (const item of results.items) {
      item.tags = responseTags.filter((rt) => (rt as any).response === item.id);
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

  const { tags: tagUpdates, ...updates } = data.updates;
  const result = await batchUpdate(
    CalloutResponse,
    filters,
    rules,
    updates,
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

export * from "./interface";

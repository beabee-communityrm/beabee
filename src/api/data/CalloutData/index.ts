import { BadRequestError, UnauthorizedError } from "routing-controllers";
import { createQueryBuilder, getRepository } from "typeorm";

import { fetchPaginated, mergeRules, Paginated } from "@api/utils/pagination";

import ItemStatus, { ruleAsQuery } from "@models/ItemStatus";
import Member from "@models/Member";
import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";

import {
  GetCalloutWith,
  GetCalloutsQuery,
  GetCalloutResponsesQuery,
  GetCalloutResponseData,
  GetCalloutData
} from "./interface";

interface ConvertOpts {
  with?: GetCalloutWith[] | undefined;
}

export async function convertCalloutToData(
  poll: Poll,
  member: Member | undefined,
  opts: ConvertOpts
): Promise<GetCalloutData> {
  // fetchPaginatedCallouts prefetches these to reduce the number of queries
  const hasAnswered =
    opts.with?.includes(GetCalloutWith.HasAnswered) && member
      ? poll.hasAnswered !== undefined
        ? poll.hasAnswered
        : (await getRepository(PollResponse).count({ poll, member })) > 0
      : undefined;

  const responseCount =
    opts.with?.includes(GetCalloutWith.ResponseCount) && member
      ? poll.responseCount !== undefined
        ? poll.responseCount
        : await getRepository(PollResponse).count({ poll })
      : undefined;

  return {
    slug: poll.slug,
    title: poll.title,
    excerpt: poll.excerpt,
    image: poll.image,
    allowUpdate: poll.allowUpdate,
    allowMultiple: poll.allowMultiple,
    access: poll.access,
    status: poll.status,
    hidden: poll.hidden,
    starts: poll.starts,
    expires: poll.expires,
    ...(hasAnswered !== undefined && { hasAnswered }),
    ...(responseCount !== undefined && { responseCount }),
    ...(opts.with?.includes(GetCalloutWith.Form) && {
      intro: poll.intro,
      thanksText: poll.thanksText,
      thanksTitle: poll.thanksTitle,
      formSchema: poll.formSchema,
      ...(poll.thanksRedirect && { thanksRedirect: poll.thanksRedirect }),
      ...(poll.shareTitle && { shareTitle: poll.shareTitle }),
      ...(poll.shareDescription && {
        shareDescription: poll.shareDescription
      })
    })
  };
}

export async function fetchPaginatedCallouts(
  query: GetCalloutsQuery,
  member: Member | undefined,
  opts: ConvertOpts
): Promise<Paginated<GetCalloutData>> {
  const scopedQuery = mergeRules(
    query,
    !member?.hasPermission("admin") && [
      // Non-admins can only query for open or ended non-hidden callouts
      {
        condition: "OR",
        rules: [
          { field: "status", operator: "equal", value: ItemStatus.Open },
          { field: "status", operator: "equal", value: ItemStatus.Ended }
        ]
      },
      { field: "hidden", operator: "equal", value: false }
    ]
  );

  const results = await fetchPaginated(
    Poll,
    scopedQuery,
    {
      status: ruleAsQuery,
      answeredBy: (rule, qb, suffix) => {
        if (rule.operator !== "equal" || !member) {
          throw new BadRequestError();
        }

        const value = Array.isArray(rule.value) ? rule.value[0] : rule.value;

        const id =
          value === "me" || value === member.id
            ? member.id
            : member.hasPermission("admin")
            ? value
            : undefined;

        if (!id) {
          throw new UnauthorizedError();
        }

        // TODO: deduplicate with hasAnswered
        const subQb = createQueryBuilder()
          .subQuery()
          .select("pr.pollSlug", "slug")
          .distinctOn(["pr.pollSlug"])
          .from(PollResponse, "pr")
          .where(`pr.memberId = :id${suffix}`)
          .orderBy("pr.pollSlug");

        qb.where("item.slug IN " + subQb.getQuery());

        return { id };
      }
    },
    (qb) => {
      if (member && opts.with?.includes(GetCalloutWith.ResponseCount)) {
        qb.loadRelationCountAndMap("item.responseCount", "item.responses");
      }
    }
  );

  // TODO: this should probably be a LEFT JOIN instead
  if (
    member &&
    results.items.length > 0 &&
    opts.with?.includes(GetCalloutWith.HasAnswered)
  ) {
    const answeredPolls = await createQueryBuilder(PollResponse, "pr")
      .select("pr.pollSlug", "slug")
      .distinctOn(["pr.pollSlug"])
      .where("pr.pollSlug IN (:...slugs) AND pr.memberId = :id", {
        slugs: results.items.map((item) => item.slug),
        id: member.id
      })
      .orderBy("pr.pollSlug")
      .getRawMany<{ slug: string }>();

    const answeredSlugs = answeredPolls.map((p) => p.slug);

    for (const item of results.items) {
      item.hasAnswered = answeredSlugs.includes(item.slug);
    }
  }

  return {
    ...results,
    items: await Promise.all(
      results.items.map((item) => convertCalloutToData(item, member, opts))
    )
  };
}

export async function fetchPaginatedCalloutResponses(
  slug: string,
  query: GetCalloutResponsesQuery,
  member: Member
): Promise<Paginated<GetCalloutResponseData>> {
  const scopedQuery = mergeRules(query, [
    { field: "poll", operator: "equal", value: slug },
    // Member's can only see their own responses
    !member.hasPermission("admin") && {
      field: "member",
      operator: "equal",
      value: member.id
    }
  ]);

  const results = await fetchPaginated(
    PollResponse,
    scopedQuery,
    {
      member: (rule, qb, suffix, namedWhere) => {
        qb.where(`item.member ${namedWhere}`);
        const value = Array.isArray(rule.value) ? rule.value[0] : rule.value;
        if (value === "me") {
          return { a: member.id };
        }
      }
    },
    (qb) => qb.loadAllRelationIds()
  );

  return {
    ...results,
    items: results.items.map((item) => ({
      member: item.member as unknown as string, // TODO: fix typing
      answers: item.answers,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
  };
}

export * from "./interface";

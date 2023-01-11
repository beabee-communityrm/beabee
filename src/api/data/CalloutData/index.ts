import {
  calloutFilters,
  calloutResponseFilters,
  ItemStatus
} from "@beabee/beabee-common";
import { BadRequestError, UnauthorizedError } from "routing-controllers";
import { createQueryBuilder, getRepository } from "typeorm";

import { convertContactToData } from "@api/data/ContactData";
import {
  fetchPaginated,
  mergeRules,
  Paginated,
  statusField
} from "@api/data/PaginatedData";

import Contact from "@models/Contact";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

import {
  GetCalloutWith,
  GetCalloutsQuery,
  GetCalloutResponseData,
  GetCalloutData,
  GetCalloutResponsesQuery,
  GetCalloutResponseWith
} from "./interface";

interface ConvertOpts {
  with?: GetCalloutWith[] | undefined;
}

export async function convertCalloutToData(
  callout: Callout,
  contact: Contact | undefined,
  opts: ConvertOpts
): Promise<GetCalloutData> {
  // fetchPaginatedCallouts prefetches these to reduce the number of queries
  const hasAnswered =
    opts.with?.includes(GetCalloutWith.HasAnswered) && contact
      ? callout.hasAnswered !== undefined
        ? callout.hasAnswered
        : (await getRepository(CalloutResponse).count({ callout, contact })) > 0
      : undefined;

  const responseCount =
    opts.with?.includes(GetCalloutWith.ResponseCount) && contact
      ? callout.responseCount !== undefined
        ? callout.responseCount
        : await getRepository(CalloutResponse).count({ callout })
      : undefined;

  return {
    slug: callout.slug,
    title: callout.title,
    excerpt: callout.excerpt,
    image: callout.image,
    allowUpdate: callout.allowUpdate,
    allowMultiple: callout.allowMultiple,
    access: callout.access,
    status: callout.status,
    hidden: callout.hidden,
    starts: callout.starts,
    expires: callout.expires,
    ...(hasAnswered !== undefined && { hasAnswered }),
    ...(responseCount !== undefined && { responseCount }),
    ...(opts.with?.includes(GetCalloutWith.Form) && {
      intro: callout.intro,
      thanksText: callout.thanksText,
      thanksTitle: callout.thanksTitle,
      formSchema: callout.formSchema,
      ...(callout.thanksRedirect && { thanksRedirect: callout.thanksRedirect }),
      ...(callout.shareTitle && { shareTitle: callout.shareTitle }),
      ...(callout.shareDescription && {
        shareDescription: callout.shareDescription
      })
    })
  };
}

export async function fetchPaginatedCallouts(
  query: GetCalloutsQuery,
  contact: Contact | undefined,
  opts: ConvertOpts
): Promise<Paginated<GetCalloutData>> {
  const scopedQuery = mergeRules(
    query,
    !contact?.hasRole("admin") && [
      // Non-admins can only query for open or ended non-hidden callouts
      {
        condition: "OR",
        rules: [
          { field: "status", operator: "equal", value: [ItemStatus.Open] },
          { field: "status", operator: "equal", value: [ItemStatus.Ended] }
        ]
      },
      { field: "hidden", operator: "equal", value: [false] }
    ]
  );

  const results = await fetchPaginated(
    Callout,
    calloutFilters,
    scopedQuery,
    contact,
    {
      status: statusField,
      answeredBy: (qb, { operator, whereFn, values }) => {
        // TODO: support not_equal for admins
        if (operator !== "equal") {
          throw new BadRequestError("answeredBy only supports equal");
        }
        if (!contact) {
          throw new BadRequestError(
            "answeredBy can only be used with contact scope"
          );
        }

        if (values[0] !== contact.id && !contact.hasRole("admin")) {
          throw new UnauthorizedError();
        }

        // TODO: deduplicate with hasAnswered
        const subQb = createQueryBuilder()
          .subQuery()
          .select("pr.calloutSlug", "slug")
          .distinctOn(["pr.calloutSlug"])
          .from(CalloutResponse, "pr")
          .where(whereFn(`pr.contactId`))
          .orderBy("pr.calloutSlug");

        qb.where("item.slug IN " + subQb.getQuery());
      }
    },
    (qb) => {
      if (contact && opts.with?.includes(GetCalloutWith.ResponseCount)) {
        qb.loadRelationCountAndMap("item.responseCount", "item.responses");
      }
    }
  );

  // TODO: this should probably be a LEFT JOIN instead
  if (
    contact &&
    results.items.length > 0 &&
    opts.with?.includes(GetCalloutWith.HasAnswered)
  ) {
    const answeredCallouts = await createQueryBuilder(CalloutResponse, "pr")
      .select("pr.calloutSlug", "slug")
      .distinctOn(["pr.calloutSlug"])
      .where("pr.calloutSlug IN (:...slugs) AND pr.contactId = :id", {
        slugs: results.items.map((item) => item.slug),
        id: contact.id
      })
      .orderBy("pr.calloutSlug")
      .getRawMany<{ slug: string }>();

    const answeredSlugs = answeredCallouts.map((p) => p.slug);

    for (const item of results.items) {
      item.hasAnswered = answeredSlugs.includes(item.slug);
    }
  }

  return {
    ...results,
    items: await Promise.all(
      results.items.map((item) => convertCalloutToData(item, contact, opts))
    )
  };
}

export async function fetchPaginatedCalloutResponses(
  slug: string,
  query: GetCalloutResponsesQuery,
  contact: Contact
): Promise<Paginated<GetCalloutResponseData>> {
  const scopedQuery = mergeRules(query, [
    { field: "callout", operator: "equal", value: [slug] },
    // Contact's can only see their own responses
    !contact.hasRole("admin") && {
      field: "contact",
      operator: "equal",
      value: [contact.id]
    }
  ]);

  const results = await fetchPaginated(
    CalloutResponse,
    calloutResponseFilters,
    scopedQuery,
    contact,
    undefined,
    (qb) => {
      if (query.with?.includes(GetCalloutResponseWith.Contact)) {
        qb.leftJoinAndSelect("item.contact", "contact");
      }
    }
  );

  return {
    ...results,
    items: results.items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ...(query.with?.includes(GetCalloutResponseWith.Answers) && {
        answers: item.answers
      }),
      ...(item.contact && {
        contact: convertContactToData(item.contact)
      })
    }))
  };
}

export * from "./interface";

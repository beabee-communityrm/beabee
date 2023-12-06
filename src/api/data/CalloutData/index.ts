import { calloutFilters, ItemStatus } from "@beabee/beabee-common";
import { BadRequestError, UnauthorizedError } from "routing-controllers";
import { createQueryBuilder, FindOptionsWhere } from "typeorm";

import { getRepository } from "@core/database";

import {
  fetchPaginated,
  mergeRules,
  Paginated,
  statusFieldHandler
} from "@api/data/PaginatedData";

import Contact from "@models/Contact";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

import {
  GetCalloutWith,
  GetCalloutsQuery,
  GetCalloutData,
  GetCalloutQuery
} from "./interface";

interface ConvertOpts {
  with?: GetCalloutWith[] | undefined;
}

export function convertCalloutToData(
  callout: Callout,
  opts?: ConvertOpts
): GetCalloutData {
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
    ...(callout.hasAnswered !== undefined && {
      hasAnswered: callout.hasAnswered
    }),
    ...(callout.responseCount !== undefined && {
      responseCount: callout.responseCount
    }),
    ...(opts?.with?.includes(GetCalloutWith.Form) && {
      intro: callout.intro,
      thanksText: callout.thanksText,
      thanksTitle: callout.thanksTitle,
      formSchema: callout.formSchema,
      ...(callout.thanksRedirect && { thanksRedirect: callout.thanksRedirect }),
      ...(callout.shareTitle && { shareTitle: callout.shareTitle }),
      ...(callout.shareDescription && {
        shareDescription: callout.shareDescription
      })
    }),
    ...(opts?.with?.includes(GetCalloutWith.ResponseViewSchema) && {
      responseViewSchema: callout.responseViewSchema
    })
  };
}

export async function fetchCallout(
  where: FindOptionsWhere<Callout>,
  query: GetCalloutQuery,
  contact: Contact | undefined
): Promise<GetCalloutData | undefined> {
  const callout = await getRepository(Callout).findOne({ where });

  if (
    !callout ||
    // Non-admins can only load open and ended callouts
    (!contact?.hasRole("admin") &&
      callout.status !== ItemStatus.Open &&
      callout.status !== ItemStatus.Ended)
  ) {
    return;
  }

  if (query.with?.includes(GetCalloutWith.HasAnswered) && contact) {
    callout.hasAnswered =
      (await getRepository(CalloutResponse).count({
        where: { calloutSlug: callout.slug, contactId: contact.id }
      })) > 0;
  }

  if (query.with?.includes(GetCalloutWith.ResponseCount)) {
    callout.responseCount = await getRepository(CalloutResponse).count({
      where: { calloutSlug: callout.slug }
    });
  }

  return convertCalloutToData(callout, query);
}

export async function fetchPaginatedCallouts(
  query: GetCalloutsQuery,
  contact: Contact | undefined
): Promise<Paginated<GetCalloutData>> {
  const scopedQuery = contact?.hasRole("admin")
    ? query
    : {
        ...query,
        rules: mergeRules([
          query.rules,
          // Non-admins can only query for open or ended non-hidden callouts
          {
            condition: "OR",
            rules: [
              { field: "status", operator: "equal", value: [ItemStatus.Open] },
              { field: "status", operator: "equal", value: [ItemStatus.Ended] }
            ]
          },
          { field: "hidden", operator: "equal", value: [false] }
        ])
      };

  const results = await fetchPaginated(
    Callout,
    calloutFilters,
    scopedQuery,
    contact,
    {
      status: statusFieldHandler,
      answeredBy: (qb, args) => {
        // TODO: support not_equal for admins
        if (args.operator !== "equal") {
          throw new BadRequestError("answeredBy only supports equal");
        }
        if (!contact) {
          throw new BadRequestError(
            "answeredBy can only be used with valid contact"
          );
        }

        if (args.value[0] !== contact.id && !contact.hasRole("admin")) {
          throw new UnauthorizedError();
        }

        // TODO: deduplicate with hasAnswered
        const subQb = createQueryBuilder()
          .subQuery()
          .select("pr.calloutSlug", "slug")
          .distinctOn(["pr.calloutSlug"])
          .from(CalloutResponse, "pr")
          .where(args.whereFn(`pr.contactId`))
          .orderBy("pr.calloutSlug");

        qb.where(`${args.fieldPrefix}slug IN ${subQb.getQuery()}`);
      }
    },
    (qb, fieldPrefix) => {
      if (contact && query.with?.includes(GetCalloutWith.ResponseCount)) {
        qb.loadRelationCountAndMap(
          `${fieldPrefix}responseCount`,
          `${fieldPrefix}responses`
        );
      }
    }
  );

  // TODO: this should probably be a LEFT JOIN instead
  if (
    contact &&
    results.items.length > 0 &&
    query.with?.includes(GetCalloutWith.HasAnswered)
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
      results.items.map((item) => convertCalloutToData(item, query))
    )
  };
}

export * from "./interface";

import {
  CalloutFilterName,
  calloutFilters,
  Filters,
  ItemStatus,
  PaginatedQuery
} from "@beabee/beabee-common";
import { TransformPlainToInstance } from "class-transformer";
import { BadRequestError, UnauthorizedError } from "routing-controllers";
import { SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "@core/database";

import {
  GetCalloutWith,
  ListCalloutsDto,
  GetCalloutDto,
  GetCalloutOptsDto
} from "@api/dto/CalloutDto";
import { BaseTransformer } from "@api/transformers/BaseTransformer";
import { mergeRules, statusFilterHandler } from "@api/utils/rules";

import Contact from "@models/Contact";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

import { AuthInfo } from "@type/auth-info";
import { FilterHandlers } from "@type/filter-handlers";

class CalloutTransformer extends BaseTransformer<
  Callout,
  GetCalloutDto,
  CalloutFilterName,
  GetCalloutOptsDto
> {
  protected model = Callout;
  protected modelIdField = "slug";
  protected filters = calloutFilters;
  protected filterHandlers = { status: statusFilterHandler };

  protected transformFilters(
    query: GetCalloutOptsDto & PaginatedQuery,
    auth: AuthInfo | undefined
  ): [Partial<Filters<CalloutFilterName>>, FilterHandlers<CalloutFilterName>] {
    return [
      {},
      {
        answeredBy: (qb, args) => {
          // TODO: support not_equal for admins
          if (args.operator !== "equal") {
            throw new BadRequestError("answeredBy only supports equal");
          }

          if (
            !auth?.roles.includes("admin") &&
            args.value[0] !== auth?.entity.id
          ) {
            throw new UnauthorizedError();
          }

          // TODO: deduplicate with hasAnswered
          const subQb = createQueryBuilder()
            .subQuery()
            .select("cr.calloutSlug", "slug")
            .distinctOn(["cr.calloutSlug"])
            .from(CalloutResponse, "cr")
            .where(args.whereFn(`cr.contactId`))
            .orderBy("cr.calloutSlug");

          qb.where(`${args.fieldPrefix}slug IN ${subQb.getQuery()}`);
        }
      }
    ];
  }

  @TransformPlainToInstance(GetCalloutDto)
  convert(callout: Callout, opts?: GetCalloutOptsDto): GetCalloutDto {
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
        ...(callout.thanksRedirect && {
          thanksRedirect: callout.thanksRedirect
        }),
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

  protected transformQuery<T extends ListCalloutsDto>(
    query: T,
    auth: AuthInfo | undefined
  ): T {
    if (auth?.roles.includes("admin")) {
      return query;
    }

    // Non-admins can't see response counts
    if (query.with?.includes(GetCalloutWith.ResponseCount)) {
      throw new UnauthorizedError();
    }

    // Non-admins can only query for open or ended non-hidden callouts
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        {
          condition: "OR",
          rules: [
            {
              field: "status",
              operator: "equal",
              value: [ItemStatus.Open]
            },
            {
              field: "status",
              operator: "equal",
              value: [ItemStatus.Ended]
            }
          ]
        },
        !query.showHiddenForAll && {
          field: "hidden",
          operator: "equal",
          value: [false]
        }
      ])
    };
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Callout>,
    fieldPrefix: string,
    query: ListCalloutsDto
  ): void {
    if (query.with?.includes(GetCalloutWith.ResponseCount)) {
      qb.loadRelationCountAndMap(
        `${fieldPrefix}responseCount`,
        `${fieldPrefix}responses`
      );
    }
  }

  protected async modifyItems(
    callouts: Callout[],
    query: ListCalloutsDto,
    auth: AuthInfo | undefined
  ): Promise<void> {
    if (
      callouts.length > 0 &&
      auth?.entity instanceof Contact &&
      query.with?.includes(GetCalloutWith.HasAnswered)
    ) {
      const answeredCallouts = await createQueryBuilder(CalloutResponse, "cr")
        .select("cr.calloutSlug", "slug")
        .distinctOn(["cr.calloutSlug"])
        .where("cr.calloutSlug IN (:...slugs) AND cr.contactId = :id", {
          slugs: callouts.map((c) => c.slug),
          id: auth.entity.id
        })
        .orderBy("cr.calloutSlug")
        .getRawMany<{ slug: string }>();

      const answeredSlugs = answeredCallouts.map((c) => c.slug);

      for (const callout of callouts) {
        callout.hasAnswered = answeredSlugs.includes(callout.slug);
      }
    }
  }
}

export default new CalloutTransformer();

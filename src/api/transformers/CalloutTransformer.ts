import {
  CalloutFilterName,
  calloutFilters,
  ItemStatus,
  PaginatedQuery
} from "@beabee/beabee-common";
import { BadRequestError, UnauthorizedError } from "routing-controllers";
import { SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "@core/database";

import {
  FieldHandlers,
  mergeRules,
  Paginated,
  statusFieldHandler
} from "@api/data/PaginatedData";

import Contact from "@models/Contact";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

import {
  GetCalloutWith,
  ListCalloutsDto,
  GetCalloutDto,
  GetCalloutOptsDto
} from "../dto/CalloutDto";
import { BaseTransformer } from "./BaseTransformer";

class CalloutTransformer extends BaseTransformer<
  Callout,
  GetCalloutDto,
  CalloutFilterName,
  GetCalloutOptsDto
> {
  model = Callout;
  modelIdField = "slug";
  filters = calloutFilters;

  protected getFieldHandlers(
    caller: Contact | undefined
  ): FieldHandlers<CalloutFilterName> {
    return {
      status: statusFieldHandler,
      answeredBy: (qb, args) => {
        // TODO: support not_equal for admins
        if (args.operator !== "equal") {
          throw new BadRequestError("answeredBy only supports equal");
        }

        if (
          !caller ||
          (args.value[0] !== caller.id && !caller.hasRole("admin"))
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
    };
  }

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

  transformQuery(
    query: ListCalloutsDto,
    caller: Contact | undefined
  ): ListCalloutsDto {
    if (caller?.hasRole("admin")) {
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
        // TODO: conditional on fetchOne vs fetch
        { field: "hidden", operator: "equal", value: [false] }
      ])
    };
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Callout>,
    fieldPrefix: string,
    opts: GetCalloutOptsDto
  ): void {
    if (opts.with?.includes(GetCalloutWith.ResponseCount)) {
      qb.loadRelationCountAndMap(
        `${fieldPrefix}responseCount`,
        `${fieldPrefix}responses`
      );
    }
  }

  protected async modifyResult(
    result: Paginated<Callout>,
    query: GetCalloutOptsDto & PaginatedQuery,
    caller: Contact | undefined
  ): Promise<void> {
    if (
      caller &&
      result.items.length > 0 &&
      query.with?.includes(GetCalloutWith.HasAnswered)
    ) {
      const answeredCallouts = await createQueryBuilder(CalloutResponse, "cr")
        .select("cr.calloutSlug", "slug")
        .distinctOn(["cr.calloutSlug"])
        .where("cr.calloutSlug IN (:...slugs) AND cr.contactId = :id", {
          slugs: result.items.map((item) => item.slug),
          id: caller.id
        })
        .orderBy("cr.calloutSlug")
        .getRawMany<{ slug: string }>();

      const answeredSlugs = answeredCallouts.map((p) => p.slug);

      for (const item of result.items) {
        item.hasAnswered = answeredSlugs.includes(item.slug);
      }
    }
  }
}

export default new CalloutTransformer();

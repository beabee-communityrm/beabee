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
  GetCalloutOptsDto,
  CalloutVariantsDto
} from "@api/dto/CalloutDto";
import NotFoundError from "@api/errors/NotFoundError";
import { BaseTransformer } from "@api/transformers/BaseTransformer";
import CalloutVariantTransformer from "@api/transformers/CalloutVariantTransformer";
import { groupBy } from "@api/utils";
import { mergeRules, statusFilterHandler } from "@api/utils/rules";

import Contact from "@models/Contact";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

import { AuthInfo } from "@type/auth-info";
import { FilterHandlers } from "@type/filter-handlers";
import CalloutVariant from "@models/CalloutVariant";

class CalloutTransformer extends BaseTransformer<
  Callout,
  GetCalloutDto,
  CalloutFilterName,
  GetCalloutOptsDto
> {
  protected model = Callout;
  protected modelIdField = "id";
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
            .select("cr.calloutId")
            .distinctOn(["cr.calloutId"])
            .from(CalloutResponse, "cr")
            .where(args.whereFn(`cr.contactId`))
            .orderBy("cr.calloutId");

          qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
        }
      }
    ];
  }

  @TransformPlainToInstance(GetCalloutDto)
  convert(callout: Callout, opts?: GetCalloutOptsDto): GetCalloutDto {
    const variants = Object.fromEntries(
      callout.variants.map((variant) => [
        variant.locale,
        CalloutVariantTransformer.convert(variant)
      ])
    ) as CalloutVariantsDto;

    const variant =
      (opts?.locale && variants[opts?.locale]) || variants.default;

    return {
      id: callout.id,
      slug: callout.slug,
      title: variant.title,
      excerpt: variant.excerpt,
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
        intro: variant.intro,
        thanksText: variant.thanksText,
        thanksTitle: variant.thanksTitle,
        formSchema: callout.formSchema,
        ...(variant.thanksRedirect && {
          thanksRedirect: variant.thanksRedirect
        }),
        ...(variant.shareTitle && { shareTitle: variant.shareTitle }),
        ...(variant.shareDescription && {
          shareDescription: variant.shareDescription
        })
      }),
      ...(opts?.with?.includes(GetCalloutWith.ResponseViewSchema) && {
        responseViewSchema: callout.responseViewSchema
      }),
      ...(opts?.with?.includes(GetCalloutWith.Variants) && {
        variants
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

    return {
      ...query,
      // Non-admins can only query for open or ended non-hidden callouts
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

    // Load a variant unless we will load all of them anyway
    if (!query.with?.includes(GetCalloutWith.Variants)) {
      qb.leftJoinAndSelect(
        `${fieldPrefix}variants`,
        "v",
        "v.locale = :locale",
        { locale: query.locale || "default" }
      );
    }
  }

  protected async modifyItems(
    callouts: Callout[],
    query: ListCalloutsDto,
    auth: AuthInfo | undefined
  ): Promise<void> {
    if (callouts.length > 0) {
      const calloutIds = callouts.map((c) => c.id);

      if (query.with?.includes(GetCalloutWith.Variants)) {
        const variants = await createQueryBuilder(CalloutVariant, "cv")
          .where("cv.calloutId IN (:...ids)", { ids: calloutIds })
          .getMany();

        const variantsById = groupBy(variants, (v) => v.calloutId);

        for (const callout of callouts) {
          callout.variants = variantsById[callout.id] || [];
        }
      }

      if (
        auth?.entity instanceof Contact &&
        query.with?.includes(GetCalloutWith.HasAnswered)
      ) {
        const answeredCallouts = await createQueryBuilder(CalloutResponse, "cr")
          .select("cr.calloutId", "id")
          .distinctOn(["cr.calloutId"])
          .where("cr.calloutId IN (:...ids) AND cr.contactId = :id", {
            ids: calloutIds,
            id: auth.entity.id
          })
          .orderBy("cr.calloutId")
          .getRawMany<{ id: string }>();

        const answeredIds = answeredCallouts.map((c) => c.id);

        for (const callout of callouts) {
          callout.hasAnswered = answeredIds.includes(callout.id);
        }
      }
    }
  }
}

export default new CalloutTransformer();

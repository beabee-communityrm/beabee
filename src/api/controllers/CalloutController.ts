import moment from "moment";
import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  Param,
  QueryParams
} from "routing-controllers";
import { Brackets, createQueryBuilder, getRepository } from "typeorm";

import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";

import {
  GetBasicCalloutData,
  GetCalloutResponseData,
  GetCalloutResponsesQuery,
  GetCalloutsQuery,
  GetMoreCalloutData
} from "@api/data/CalloutData";
import { fetchPaginated, Paginated } from "@api/utils/pagination";
import Member from "@models/Member";
import ItemStatus, { ruleAsQuery } from "@models/ItemStatus";

function pollToBasicCallout(poll: Poll): GetBasicCalloutData {
  return {
    slug: poll.slug,
    title: poll.title,
    excerpt: poll.excerpt,
    allowUpdate: poll.allowUpdate,
    allowMultiple: poll.allowMultiple,
    status: poll.status,
    ...(poll.image && { image: poll.image }),
    ...(poll.starts && { starts: poll.starts }),
    ...(poll.expires && { expires: poll.expires }),
    ...(poll.hasAnswered !== undefined && {
      hasAnswered: poll.hasAnswered
    })
  };
}

@JsonController("/callout")
@Authorized()
export class CalloutController {
  @Get("/")
  async getCallouts(
    @CurrentUser() member: Member,
    @QueryParams() query: GetCalloutsQuery
  ): Promise<Paginated<GetBasicCalloutData>> {
    const authQuery: GetCalloutsQuery = member.hasPermission("admin")
      ? query
      : {
          ...query,
          rules: {
            condition: "AND",
            rules: [
              // Unauthed users can only query for open non-hidden callouts
              { field: "status", operator: "equal", value: ItemStatus.Open },
              { field: "hidden", operator: "equal", value: false },
              ...(query.rules ? [query.rules] : [])
            ]
          }
        };

    const results = await fetchPaginated(
      Poll,
      authQuery,
      (qb) => {
        qb.andWhere("item.hidden = FALSE");
      },
      {
        // TODO: add validation errors
        status: ruleAsQuery,
        answeredBy: (rule, qb, suffix) => {
          if (rule.operator !== "equal") return;

          // TODO: allow admins to filter for other users
          if (rule.value !== "me" && rule.value !== member.id) return;

          // TODO: deduplicate with hasAnswered
          const subQb = createQueryBuilder()
            .subQuery()
            .select("pr.pollSlug", "slug")
            .distinctOn(["pr.pollSlug"])
            .from(PollResponse, "pr")
            .where(`pr.memberId = :id${suffix}`)
            .orderBy("pr.pollSlug");

          qb.where("item.slug IN " + subQb.getQuery());

          return {
            id: member.id
          };
        }
      }
    );

    if (
      results.items.length > 0 &&
      (query.hasAnswered === "me" || query.hasAnswered === member.id)
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
      items: results.items.map(pollToBasicCallout)
    };
  }

  @Get("/:slug")
  async getCallout(
    @Param("slug") slug: string
  ): Promise<GetMoreCalloutData | undefined> {
    const poll = await getRepository(Poll).findOne(slug);
    if (poll) {
      return {
        ...pollToBasicCallout(poll),
        templateSchema: poll.templateSchema
      };
    }
  }

  @Get("/:slug/responses")
  async getCalloutResponses(
    @CurrentUser() member: Member,
    @Param("slug") slug: string,
    @QueryParams() query: GetCalloutResponsesQuery
  ): Promise<Paginated<GetCalloutResponseData>> {
    const results = await fetchPaginated(
      PollResponse,
      query,
      (qb) => {
        qb.andWhere("item.poll = :slug", { slug }).loadAllRelationIds();

        if (!member.hasPermission("admin")) {
          qb.andWhere("item.member = :id", { id: member.id });
        }
      },
      {
        member: (rule, qb, suffix, namedWhere) => {
          qb.where(`item.member ${namedWhere}`);
          if (rule.value === "me") {
            return { a: member.id };
          }
        }
      }
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
}

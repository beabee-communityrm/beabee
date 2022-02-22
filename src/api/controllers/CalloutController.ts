import moment from "moment";
import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  Params,
  QueryParams
} from "routing-controllers";
import { Brackets, createQueryBuilder, getRepository } from "typeorm";

import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";

import { UUIDParam } from "@api/data";
import {
  CalloutStatus,
  GetBasicCalloutData,
  GetCalloutsQuery,
  GetMoreCalloutData
} from "@api/data/CalloutData";
import { fetchPaginated, Paginated } from "@api/utils/pagination";
import Member from "@models/Member";

function pollToBasicCallout(poll: Poll): GetBasicCalloutData {
  return {
    slug: poll.slug,
    title: poll.title,
    excerpt: poll.excerpt,
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
    const results = await fetchPaginated(Poll, query, (qb) => {
      qb.andWhere("item.hidden = FALSE");

      // TODO: should be in the rules query
      if (query.status === CalloutStatus.Open) {
        qb.andWhere("item.closed = FALSE")
          .andWhere(
            new Brackets((qb) => {
              qb.where("item.expires IS NULL").orWhere("item.expires > :now");
            })
          )
          .andWhere(
            new Brackets((qb) => {
              qb.where("item.starts IS NULL").orWhere("item.starts < :now");
            })
          );
      } else if (query.status === CalloutStatus.Finished) {
        qb.andWhere(
          new Brackets((qb) => {
            qb.where("item.starts IS NULL").orWhere("item.starts < :now");
          })
        ).andWhere(
          new Brackets((qb) => {
            qb.where("item.closed = TRUE").orWhere("item.expires < :now");
          })
        );
      }

      qb.setParameters({ now: moment.utc().toDate() });

      console.log(qb.getSql());
    });

    if (
      results.items.length > 0 &&
      (query.hasAnswered === "me" || query.hasAnswered === member.id)
    ) {
      const answeredPolls = await createQueryBuilder(PollResponse, "pr")
        .select("pr.pollSlug", "slug")
        .distinctOn(["pr.pollSlug"])
        .orderBy("pr.pollSlug")
        .where("pr.pollSlug IN (:...slugs) AND pr.memberId = :id", {
          slugs: results.items.map((item) => item.slug),
          id: member.id
        })
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

  @Get("/:id")
  async getCallout(
    @Params() { id }: UUIDParam
  ): Promise<GetMoreCalloutData | undefined> {
    const poll = await getRepository(Poll).findOne(id);
    if (poll) {
      return {
        ...pollToBasicCallout(poll),
        templateSchema: poll.templateSchema
      };
    }
  }
}

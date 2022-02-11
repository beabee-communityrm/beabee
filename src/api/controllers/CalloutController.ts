import moment from "moment";
import {
  Authorized,
  Get,
  JsonController,
  Params,
  QueryParams
} from "routing-controllers";
import { Brackets, createQueryBuilder, getRepository } from "typeorm";

import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";

import { Paginated, UUIDParam } from "@api/data";
import {
  CalloutStatus,
  GetBasicCalloutData,
  GetCalloutsQuery,
  GetMoreCalloutData
} from "@api/data/CalloutData";

function pollToBasicCallout(poll: Poll): GetBasicCalloutData {
  return {
    slug: poll.slug,
    title: poll.title,
    excerpt: poll.excerpt,
    ...(poll.image && { image: poll.image }),
    ...(poll.starts && { starts: poll.starts }),
    ...(poll.expires && { expires: poll.expires })
  };
}

@JsonController("/callout")
@Authorized()
export class CalloutController {
  @Get("/")
  async getCallouts(
    @QueryParams() query: GetCalloutsQuery
  ): Promise<Paginated<GetBasicCalloutData>> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const qb = createQueryBuilder(Poll, "poll").where("poll.hidden = FALSE");

    if (query.status === CalloutStatus.Open) {
      qb.andWhere("poll.closed = FALSE")
        .andWhere(
          new Brackets((qb) => {
            qb.where("poll.expires IS NULL").orWhere("poll.expires > :now");
          })
        )
        .andWhere(
          new Brackets((qb) => {
            qb.where("poll.starts IS NULL").orWhere("poll.starts < :now");
          })
        );
    } else if (query.status === CalloutStatus.Finished) {
      qb.andWhere(
        new Brackets((qb) => {
          qb.where("poll.starts IS NULL").orWhere("poll.starts < :now");
        })
      ).andWhere(
        new Brackets((qb) => {
          qb.where("poll.closed = TRUE").orWhere("poll.expires < :now");
        })
      );
    }

    if (query.answered) {
      qb.innerJoin(PollResponse, "pr", "poll.slug = pr.pollSlug");
    }

    const [polls, total] = await qb
      .setParameters({ now: moment.utc().toDate() })
      .offset(offset)
      .limit(limit)
      .getManyAndCount();

    return {
      total,
      offset,
      count: polls.length,
      items: polls.map(pollToBasicCallout)
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

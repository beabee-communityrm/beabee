import moment from "moment";
import {
  Authorized,
  Get,
  JsonController,
  Params,
  QueryParams
} from "routing-controllers";
import { Brackets, getRepository } from "typeorm";

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
    const results = await fetchPaginated(Poll, query, (qb) => {
      qb.andWhere("item.hidden = FALSE");

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

      if (query.answered) {
        qb.innerJoin(PollResponse, "pr", "item.slug = pr.pollSlug");
      }

      qb.setParameters({ now: moment.utc().toDate() });
    });

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

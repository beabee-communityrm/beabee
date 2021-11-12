import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import moment from "moment";
import {
  Authorized,
  Get,
  JsonController,
  Param,
  QueryParams
} from "routing-controllers";
import { Brackets, createQueryBuilder, getRepository } from "typeorm";

import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";

enum Status {
  Open = "open",
  Finished = "finished"
}

class GetCalloutsQuery {
  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @IsBoolean()
  answered?: boolean;

  @IsOptional()
  @IsString()
  title?: string;
}

interface BasicCalloutData {
  slug: string;
  title: string;
  excerpt: string;
  image?: string;
  starts?: Date;
  expires?: Date;
}

interface MoreCalloutData extends BasicCalloutData {
  templateSchema?: Record<string, unknown>;
}

function pollToBasicCallout(poll: Poll): BasicCalloutData {
  return {
    slug: poll.slug,
    title: poll.title,
    excerpt: poll.excerpt,
    image: poll.image,
    starts: poll.starts,
    expires: poll.expires
  };
}

@JsonController("/callout")
@Authorized()
export class CalloutController {
  @Get("/")
  async getCallouts(
    @QueryParams() query: GetCalloutsQuery
  ): Promise<BasicCalloutData[]> {
    const qb = createQueryBuilder(Poll, "poll").where("poll.hidden = FALSE");

    if (query.status === Status.Open) {
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
    } else if (query.status === Status.Finished) {
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

    if (query.title) {
      qb.andWhere("LOWER(poll.title) LIKE :title", {
        title: "%" + query.title.toLowerCase() + "%"
      });
    }

    const polls = await qb
      .setParameters({ now: moment.utc().toDate() })
      .getMany();
    return polls.map(pollToBasicCallout);
  }

  @Get("/:id")
  async getCallout(
    @Param("id") id: string
  ): Promise<MoreCalloutData | undefined> {
    const poll = await getRepository(Poll).findOne(id);
    if (poll) {
      return {
        ...pollToBasicCallout(poll),
        templateSchema: poll.templateSchema
      };
    }
  }
}

import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import moment from "moment";
import { Get, JsonController, QueryParams } from "routing-controllers";
import { Brackets, createQueryBuilder } from "typeorm";

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

@JsonController("/callout")
export class CalloutController {
  @Get("/")
  async getCallouts(@QueryParams() query: GetCalloutsQuery): Promise<Poll[]> {
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

    return await qb.setParameters({ now: moment.utc().toDate() }).getMany();
  }
}

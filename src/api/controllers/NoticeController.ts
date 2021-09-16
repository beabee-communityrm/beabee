import { IsEnum, IsOptional } from "class-validator";
import moment from "moment";
import {
  Authorized,
  Get,
  JsonController,
  QueryParams
} from "routing-controllers";
import { Brackets, createQueryBuilder } from "typeorm";

import Notice from "@models/Notice";

enum Status {
  Open = "open",
  Finished = "finished"
}

class GetNoticesQuery {
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(@QueryParams() query: GetNoticesQuery): Promise<Notice[]> {
    const qb = createQueryBuilder(Notice, "notice");
    if (query.status === Status.Open) {
      qb.where("notice.enabled = TRUE").andWhere(
        new Brackets((qb) => {
          qb.where("notice.expires IS NULL").orWhere("notice.expires > :now", {
            now: moment.utc().toDate()
          });
        })
      );
    } else if (query.status === Status.Finished) {
      qb.where("notice.enabled = FALSE").orWhere("notice.expires < :now", {
        now: moment.utc().toDate()
      });
    }
    return await qb.getMany();
  }
}

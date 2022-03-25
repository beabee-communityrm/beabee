import moment from "moment";
import { Brackets, createQueryBuilder } from "typeorm";

import Notice from "@models/Notice";

export default class NoticeService {
  static async findActive(): Promise<Notice[]> {
    return createQueryBuilder(Notice, "notice")
      .where("notice.starts < :now")
      .andWhere(
        new Brackets((qb) => {
          qb.where("notice.expires IS NULL").orWhere("notice.expires > :now");
        })
      )
      .setParameter("now", moment.utc().toDate())
      .getMany();
  }
}

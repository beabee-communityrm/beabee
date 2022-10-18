import Payment from "@models/Payment";
import Member from "@models/Member";
import { Type } from "class-transformer";
import { IsDate } from "class-validator";
import {
  Authorized,
  Get,
  InternalServerError,
  JsonController,
  QueryParams
} from "routing-controllers";
import { createQueryBuilder } from "typeorm";

class GetStatsQuery {
  @Type(() => Date)
  @IsDate()
  from!: Date;

  @Type(() => Date)
  @IsDate()
  to!: Date;
}

interface GetStatsData {
  newMembers: number;
  averageContribution: number | null;
  totalRevenue: number | null;
}

@JsonController("/stats")
export class StatsController {
  @Authorized("admin")
  @Get("/")
  async getStats(@QueryParams() query: GetStatsQuery): Promise<GetStatsData> {
    const newMembers = await createQueryBuilder(Member, "m")
      .innerJoin("m.permissions", "mp")
      .where("m.joined BETWEEN :from AND :to", query)
      .andWhere(
        "mp.permission = 'member' AND mp.dateAdded BETWEEN :from AND :to",
        query
      )
      .getCount();

    const payments = await createQueryBuilder(Payment, "p")
      .innerJoin("p.member", "m")
      .select("SUM(p.amount)", "total")
      .addSelect(
        "AVG(p.amount / (CASE WHEN m.contributionPeriod = 'annually' THEN 12 ELSE 1 END))",
        "average"
      )
      .where("p.chargeDate BETWEEN :from AND :to", query)
      .andWhere("p.subscriptionId IS NOT NULL")
      .getRawOne<{ total: number | null; average: number | null }>();

    if (!payments) {
      throw new InternalServerError("No payment data");
    }

    return {
      newMembers,
      averageContribution: payments.average,
      totalRevenue: payments.total
    };
  }
}

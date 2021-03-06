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
      .where("m.joined BETWEEN :from AND :to", query)
      .getCount();

    const payments = await createQueryBuilder(Payment, "p")
      .select("SUM(p.amount)", "total")
      .addSelect("AVG(p.amount)", "average")
      .where("p.chargeDate BETWEEN :from AND :to", query)
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

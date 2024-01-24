import { plainToInstance } from "class-transformer";
import {
  Authorized,
  Get,
  InternalServerError,
  JsonController,
  QueryParams
} from "routing-controllers";

import { createQueryBuilder } from "@core/database";

import { GetStatsDto, GetStatsOptsDto } from "@api/dto/StatsDto";

import Contact from "@models/Contact";
import Payment from "@models/Payment";

@JsonController("/stats")
export class StatsController {
  @Authorized("admin")
  @Get("/")
  async getStats(@QueryParams() query: GetStatsOptsDto): Promise<GetStatsDto> {
    const newContacts = await createQueryBuilder(Contact, "m")
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

    return plainToInstance(GetStatsDto, {
      newContacts,
      averageContribution: payments.average,
      totalRevenue: payments.total
    });
  }
}

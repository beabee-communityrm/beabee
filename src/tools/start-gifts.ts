import "module-alias/register";

import moment from "moment";
import { Between, getRepository } from "typeorm";

import * as db from "@core/database";
import { log as mainLogger } from "@core/logging";

import GiftService from "@core/services/GiftService";

import GiftFlow from "@models/GiftFlow";

const log = mainLogger.child({ app: "start-gifts" });

async function main(date: string | undefined) {
  const fromDate = moment.utc(date).startOf("day");
  const toDate = moment.utc(date).endOf("day");

  log.info(
    `Processing gifts between ${fromDate.format()} and ${toDate.format()}`
  );

  const giftFlows = await getRepository(GiftFlow).find({
    where: {
      giftForm: { startDate: Between(fromDate.toDate(), toDate.toDate()) },
      completed: true,
      processed: false
    }
  });

  log.info(`Got ${giftFlows.length} gifts to process`);

  for (const giftFlow of giftFlows) {
    log.info(`Processing gift ${giftFlow.id}`);

    try {
      await GiftService.processGiftFlow(giftFlow);
    } catch (error) {
      log.error(`Error prorcessing gift ${giftFlow.id}`, error);
    }
  }
}

db.connect().then(async () => {
  try {
    await main(process.argv[2]);
  } catch (err) {
    log.error(err);
  }
  await db.close();
});

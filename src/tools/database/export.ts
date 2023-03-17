import "module-alias/register";

import { getRepository } from "typeorm";

import * as db from "@core/database";

import modelAnonymisers from "./anonymisers/models";
import { anonymiseModel, anonymiseCalloutResponses } from "./anonymisers";

async function main() {
  console.log('DELETE FROM "callout_response"');
  console.log();

  for (const anonymiser of modelAnonymisers.slice().reverse()) {
    console.log(
      `DELETE FROM "${getRepository(anonymiser.model).metadata.tableName}";`
    );
    console.log();
  }
  const valueMap = new Map<string, unknown>();
  for (const anonymiser of modelAnonymisers) {
    await anonymiseModel(anonymiser, (qb) => qb, valueMap);
  }
  await anonymiseCalloutResponses((qb) => qb, valueMap);
}

db.connect().then(async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
  await db.close();
});

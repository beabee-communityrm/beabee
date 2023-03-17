import "module-alias/register";

import { getRepository } from "typeorm";

import * as db from "@core/database";

import modelAnonymisers from "./anonymisers/models";
import { anonymiseModel } from "./anonymisers";

async function main() {
  for (const anonymiser of modelAnonymisers.slice().reverse()) {
    console.log(
      `DELETE FROM "${getRepository(anonymiser.model).metadata.tableName}";\n`
    );
  }
  const valueMap = new Map<string, unknown>();
  for (const anonymiser of modelAnonymisers) {
    await anonymiseModel(anonymiser, (qb) => qb, valueMap);
  }
}

db.connect().then(async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
  await db.close();
});

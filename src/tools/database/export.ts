import "module-alias/register";

import { getRepository } from "typeorm";

import * as db from "@core/database";

import allDriers, { runExport, runExportCalloutResponses } from "./driers";

async function main() {
  for (const drier of allDriers.slice().reverse()) {
    console.log(
      `DELETE FROM "${getRepository(drier.model).metadata.tableName}";`
    );
    console.log();
  }
  const valueMap = new Map<string, unknown>();
  for (const drier of allDriers) {
    await runExport(drier, (qb) => qb, valueMap);
  }
  await runExportCalloutResponses((qb) => qb, valueMap);
}

db.connect().then(async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
  await db.close();
});

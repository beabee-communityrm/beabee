import "module-alias/register";

import { createQueryBuilder, getRepository } from "typeorm";

import * as db from "@core/database";

import Contact from "@models/Contact";

import {
  ModelDrier,
  paymentDataDrier,
  paymentsDrier,
  contactDrier,
  contactRoleDrier,
  contacrProfileDrier,
  calloutResponsesDrier,
  calloutsDrier,
  runExport
} from "./driers";

async function main() {
  for (const drier of [
    calloutResponsesDrier,
    calloutsDrier,
    paymentDataDrier,
    paymentsDrier,
    contacrProfileDrier,
    contactRoleDrier,
    contactDrier
  ] as ModelDrier<any>[]) {
    console.log(
      `DELETE FROM "${getRepository(drier.model).metadata.tableName}";`
    );
    console.log();
  }

  const contacts = await createQueryBuilder(Contact, "m")
    .select("m.id")
    .orderBy("random()")
    .limit(400)
    .getMany();

  const contactIds = contacts.map((m) => m.id);

  const valueMap = new Map<string, unknown>();

  await runExport(
    contactDrier,
    (qb) => qb.where("item.id IN (:...ids)", { ids: contactIds }),
    valueMap
  );
  await runExport(
    contactRoleDrier,
    (qb) => qb.where("item.contactId IN (:...ids)", { ids: contactIds }),
    valueMap
  );
  await runExport(
    contacrProfileDrier,
    (qb) => qb.where("item.contactId IN (:...ids)", { ids: contactIds }),
    valueMap
  );
  await runExport(
    paymentsDrier,
    (qb) =>
      qb
        .where("item.contactId IN (:...ids)", { ids: contactIds })
        .orderBy("id"),
    valueMap
  );
  await runExport(
    paymentDataDrier,
    (qb) => qb.where("item.contactId IN (:...ids)", { ids: contactIds }),
    valueMap
  );
  await runExport(
    calloutsDrier,
    (qb) => qb.orderBy({ date: "DESC" }).limit(2),
    valueMap
  );
}

db.connect().then(async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
  await db.close();
});

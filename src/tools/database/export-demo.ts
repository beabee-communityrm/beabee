import "module-alias/register";

import { createQueryBuilder, getRepository } from "typeorm";

import * as db from "@core/database";

import Contact from "@models/Contact";

import {
  ModelAnonymiser,
  paymentDataAnonymiser,
  paymentsAnonymiser,
  contactAnonymiser,
  userRoleAnonymiser,
  contactProfileAnonymiser,
  calloutResponsesAnonymiser,
  calloutsAnonymiser
} from "./anonymisers/models";
import { anonymiseModel } from "./anonymisers";

async function main() {
  for (const drier of [
    calloutResponsesAnonymiser,
    calloutsAnonymiser,
    paymentDataAnonymiser,
    paymentsAnonymiser,
    contactProfileAnonymiser,
    userRoleAnonymiser,
    contactAnonymiser
  ] as ModelAnonymiser<any>[]) {
    console.log(
      `DELETE FROM "${getRepository(drier.model).metadata.tableName}";\n`
    );
  }

  const contacts = await createQueryBuilder(Contact, "m")
    .select("m.id")
    .orderBy("random()")
    .limit(400)
    .getMany();

  const contactIds = contacts.map((m) => m.id);

  const valueMap = new Map<string, unknown>();

  await anonymiseModel(
    contactAnonymiser,
    (qb) => qb.where("item.id IN (:...ids)", { ids: contactIds }),
    valueMap
  );
  await anonymiseModel(
    userRoleAnonymiser,
    (qb) => qb.where("item.contactId IN (:...ids)", { ids: contactIds }),
    valueMap
  );
  await anonymiseModel(
    contactProfileAnonymiser,
    (qb) => qb.where("item.contactId IN (:...ids)", { ids: contactIds }),
    valueMap
  );
  await anonymiseModel(
    paymentsAnonymiser,
    (qb) =>
      qb
        .where("item.contactId IN (:...ids)", { ids: contactIds })
        .orderBy("id"),
    valueMap
  );
  await anonymiseModel(
    paymentDataAnonymiser,
    (qb) => qb.where("item.contactId IN (:...ids)", { ids: contactIds }),
    valueMap
  );
  await anonymiseModel(
    calloutsAnonymiser,
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

import "module-alias/register";

import { Brackets } from "typeorm";

import * as db from "@core/database";

import Contact from "@models/Contact";

import {
  ModelAnonymiser,
  paymentDataAnonymiser,
  paymentsAnonymiser,
  contactAnonymiser,
  contactRoleAnonymiser,
  contactProfileAnonymiser,
  calloutResponsesAnonymiser,
  calloutsAnonymiser,
  calloutTagsAnonymiser,
  calloutResponseCommentsAnonymiser,
  calloutResponseTagsAnonymiser,
  segmentContactsAnonymiser,
  projectContactsAnonymiser,
  projectEngagmentsAnonymiser,
  referralsAnonymiser,
  resetSecurityFlowAnonymiser
} from "./anonymisers/models";
import { anonymiseModel, clearModels } from "./anonymisers";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

const contactAnonymisers = [
  contactAnonymiser,
  contactRoleAnonymiser,
  contactProfileAnonymiser,
  paymentsAnonymiser,
  paymentDataAnonymiser
] as ModelAnonymiser[];

const calloutsAnonymisers = [
  calloutsAnonymiser,
  calloutTagsAnonymiser
] as ModelAnonymiser[];

const calloutResponseAnonymisers = [
  calloutResponsesAnonymiser,
  // calloutResponseCommentsAnonymiser, TODO: make sure contact exists in export
  calloutResponseTagsAnonymiser
] as ModelAnonymiser[];

async function main() {
  const valueMap = new Map<string, unknown>();

  clearModels([
    ...contactAnonymisers,
    ...calloutsAnonymisers,
    ...calloutResponseAnonymisers,
    // Clear comments until above is fixed
    calloutResponseCommentsAnonymiser,
    // Clear models that link to contacts
    projectContactsAnonymiser,
    projectEngagmentsAnonymiser,
    segmentContactsAnonymiser,
    referralsAnonymiser,
    resetSecurityFlowAnonymiser
  ] as ModelAnonymiser[]);

  const contacts = await db
    .createQueryBuilder(Contact, "item")
    .select("item.id")
    .orderBy("random()")
    .limit(400)
    .getMany();
  const contactIds = contacts.map((m) => m.id);

  for (const anonymiser of contactAnonymisers) {
    const pk = anonymiser === contactAnonymiser ? "id" : "contactId";
    await anonymiseModel(
      anonymiser,
      (qb) =>
        qb.where(`item.${pk} IN (:...contacts)`, { contacts: contactIds }),
      valueMap
    );
  }

  const callouts = await db
    .createQueryBuilder(Callout, "item")
    .select("item.slug")
    .orderBy("item.date", "DESC")
    .limit(20)
    .getMany();
  const calloutSlugs = callouts.map((c) => c.slug);

  for (const anonymiser of calloutsAnonymisers) {
    const pk = anonymiser === calloutsAnonymiser ? "slug" : "calloutSlug";
    await anonymiseModel(
      anonymiser,
      (qb) =>
        qb.where(`item.${pk} IN (:...callouts)`, { callouts: calloutSlugs }),
      valueMap
    );
  }

  const responses = await db
    .createQueryBuilder(CalloutResponse, "item")
    .select("item.id")
    .where("item.calloutSlug IN (:...callouts)", { callouts: calloutSlugs })
    .andWhere(
      new Brackets((qb) =>
        qb
          .where("item.contact IS NULL")
          .orWhere("item.contact IN (:...contacts)")
      ),
      { contacts: contactIds }
    )
    .andWhere(
      new Brackets((qb) =>
        qb
          .where("item.assignee IS NULL")
          .orWhere("item.assignee IN (:...contacts)")
      )
    )
    .getMany();
  const responseIds = responses.map((r) => r.id);

  for (const anonymiser of calloutResponseAnonymisers) {
    const pk = anonymiser === calloutResponsesAnonymiser ? "id" : "responseId";
    await anonymiseModel(
      anonymiser,
      (qb) =>
        qb.where(`item.${pk} IN (:...responses)`, { responses: responseIds }),
      valueMap
    );
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

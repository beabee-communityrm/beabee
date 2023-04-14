import "module-alias/register";

import { createQueryBuilder } from "typeorm";

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
  resetPasswordFlowAnonymiser
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
] as ModelAnonymiser<unknown>[];

const calloutsAnonymisers = [
  calloutsAnonymiser,
  calloutTagsAnonymiser
] as ModelAnonymiser<unknown>[];

const calloutResponseAnonymisers = [
  calloutResponsesAnonymiser,
  calloutResponseCommentsAnonymiser,
  calloutResponseTagsAnonymiser
] as ModelAnonymiser<unknown>[];

async function main() {
  const valueMap = new Map<string, unknown>();

  clearModels([
    ...contactAnonymisers,
    ...calloutsAnonymisers,
    ...calloutResponseAnonymisers,
    // Clear models that link to contacts
    projectContactsAnonymiser,
    projectEngagmentsAnonymiser,
    segmentContactsAnonymiser,
    referralsAnonymiser,
    resetPasswordFlowAnonymiser
  ]);

  const contacts = await createQueryBuilder(Contact, "item")
    .select("item.id")
    .orderBy("random()")
    .limit(400)
    .getMany();
  const contactIds = contacts.map((m) => m.id);

  for (const anonymiser of contactAnonymisers) {
    const pk = anonymiser === contactAnonymiser ? "id" : "contactId";
    await anonymiseModel(
      anonymiser,
      (qb) => qb.where(`item.${pk} IN (:...ids)`, { ids: contactIds }),
      valueMap
    );
  }

  const callouts = await createQueryBuilder(Callout, "item")
    .select("item.slug")
    .orderBy("item.date", "DESC")
    .limit(20)
    .getMany();
  const calloutSlugs = callouts.map((c) => c.slug);

  for (const anonymiser of calloutsAnonymisers) {
    const pk = anonymiser === calloutsAnonymiser ? "slug" : "calloutSlug";
    await anonymiseModel(
      anonymiser,
      (qb) => qb.where(`item.${pk} IN (:...slugs)`, { slugs: calloutSlugs }),
      valueMap
    );
  }

  const responses = await createQueryBuilder(CalloutResponse, "item")
    .select("item.id")
    .where("item.calloutSlug IN (:...slugs)", { slugs: calloutSlugs })
    .getMany();
  const responseIds = responses.map((r) => r.id);

  for (const anonymiser of calloutResponseAnonymisers) {
    const pk = anonymiser === calloutResponsesAnonymiser ? "id" : "responseId";
    await anonymiseModel(
      anonymiser,
      (qb) => qb.where(`item.${pk} IN (:...ids)`, { ids: responseIds }),
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

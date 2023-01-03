import "module-alias/register";

import { NewsletterStatus } from "@beabee/beabee-common";
import { createQueryBuilder, getRepository } from "typeorm";

import * as db from "@core/database";

import NewsletterService from "@core/services/NewsletterService";

import LoginOverrideFlow from "@models/LoginOverrideFlow";
import Contact from "@models/Contact";

import config from "@config";

db.connect().then(async () => {
  const isTest = process.argv[2] === "-n";

  const contacts = await createQueryBuilder(Contact, "m")
    .innerJoinAndSelect("m.profile", "profile")
    .where("profile.newsletterStatus = :status", {
      status: NewsletterStatus.Subscribed
    })
    .getMany();

  const loFlows = await getRepository(LoginOverrideFlow).save(
    contacts.map((contact) => ({ contact }))
  );

  const membersWithFields: [Contact, Record<string, string>][] = loFlows.map(
    (loFlow) => [
      loFlow.contact,
      {
        MAGICCODE: `${config.audience}/login/code/${loFlow.contact.id}/${loFlow.id}?next=`
      }
    ]
  );

  if (isTest) {
    for (const [contact, fields] of membersWithFields) {
      console.log(contact.id, fields.MAGICCODE);
    }
    await getRepository(LoginOverrideFlow).delete(
      loFlows.map((loFlow) => loFlow.id)
    );
  } else {
    await NewsletterService.updateContactsFields(membersWithFields);
  }
  await db.close();
});

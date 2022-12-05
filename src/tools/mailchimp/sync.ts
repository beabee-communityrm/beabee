import "module-alias/register";

import { NewsletterStatus } from "@beabee/beabee-common";
import moment from "moment";
import { Between, getRepository } from "typeorm";

import * as db from "@core/database";

import ContactsService from "@core/services/ContactsService";
import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";

import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";

async function fetchContacts(
  startDate: string | undefined,
  endDate: string | undefined
): Promise<Contact[]> {
  const actualStartDate = startDate
    ? moment(startDate).toDate()
    : moment().subtract({ d: 1, h: 2 }).toDate();
  const actualEndDate = moment(endDate).toDate();

  console.log("Start date:", actualStartDate.toISOString());
  console.log("End date:", actualEndDate.toISOString());

  console.log("# Fetching contacts");

  const memberships = await getRepository(ContactRole).find({
    where: {
      type: "member",
      dateExpires: Between(actualStartDate, actualEndDate)
    },
    relations: ["contact", "contact.profile"]
  });
  console.log(`Got ${memberships.length} members`);
  return memberships.map(({ contact }) => {
    console.log(contact.membership?.isActive ? "U" : "D", contact.email);
    return contact;
  });
}

async function processContacts(contacts: Contact[]) {
  const contactsToArchive = contacts.filter(
    (m) =>
      m.profile.newsletterStatus !== NewsletterStatus.None &&
      !m.membership?.isActive
  );

  console.log(
    `Removing active member tag from ${contactsToArchive.length} contacts`
  );
  await NewsletterService.removeTagFromContacts(
    contactsToArchive,
    OptionsService.getText("newsletter-active-member-tag")
  );

  if (OptionsService.getBool("newsletter-archive-on-expired")) {
    console.log(`Archiving ${contactsToArchive.length} contacts`);
    for (const contact of contactsToArchive) {
      await ContactsService.updateContactProfile(
        contact,
        {
          newsletterStatus: NewsletterStatus.Unsubscribed
        },
        {
          // Sync in one go below with upsertContacts
          sync: false
        }
      );
    }
    await NewsletterService.upsertContacts(contactsToArchive);
    await NewsletterService.archiveContacts(contactsToArchive);
  }
}

db.connect().then(async () => {
  const isTest = process.argv[2] === "-n";
  try {
    const [startDate, endDate] = process.argv.slice(isTest ? 3 : 2);
    const contacts = await fetchContacts(startDate, endDate);
    if (!isTest) {
      await processContacts(contacts);
    }
  } catch (err) {
    console.error(err);
  }
  await db.close();
});

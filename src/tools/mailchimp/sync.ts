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

async function fetchMembers(
  startDate: string | undefined,
  endDate: string | undefined
): Promise<Contact[]> {
  const actualStartDate = startDate
    ? moment(startDate).toDate()
    : moment().subtract({ d: 1, h: 2 }).toDate();
  const actualEndDate = moment(endDate).toDate();

  console.log("Start date:", actualStartDate.toISOString());
  console.log("End date:", actualEndDate.toISOString());

  console.log("# Fetching members");

  const memberships = await getRepository(ContactRole).find({
    where: {
      permission: "member",
      dateExpires: Between(actualStartDate, actualEndDate)
    },
    relations: ["member", "member.profile"]
  });
  console.log(`Got ${memberships.length} members`);
  return memberships.map(({ member }) => {
    console.log(member.membership?.isActive ? "U" : "D", member.email);
    return member;
  });
}

async function processMembers(members: Contact[]) {
  const membersToArchive = members.filter(
    (m) =>
      m.profile.newsletterStatus !== NewsletterStatus.None &&
      !m.membership?.isActive
  );

  console.log(
    `Removing active member tag from ${membersToArchive.length} members`
  );
  await NewsletterService.removeTagFromContacts(
    membersToArchive,
    OptionsService.getText("newsletter-active-member-tag")
  );

  if (OptionsService.getBool("newsletter-archive-on-expired")) {
    console.log(`Archiving ${membersToArchive.length} members`);
    for (const member of membersToArchive) {
      await ContactsService.updateContactProfile(
        member,
        {
          newsletterStatus: NewsletterStatus.Unsubscribed
        },
        {
          // Sync in one go below with upsertMembers
          sync: false
        }
      );
    }
    await NewsletterService.upsertContacts(membersToArchive);
    await NewsletterService.archiveContacts(membersToArchive);
  }
}

db.connect().then(async () => {
  const isTest = process.argv[2] === "-n";
  try {
    const [startDate, endDate] = process.argv.slice(isTest ? 3 : 2);
    const members = await fetchMembers(startDate, endDate);
    if (!isTest) {
      await processMembers(members);
    }
  } catch (err) {
    console.error(err);
  }
  await db.close();
});

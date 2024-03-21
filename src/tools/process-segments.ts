// import "module-alias/register";

import { In } from "typeorm";

import { getRepository } from "#core/database";
import { log as mainLogger } from "#core/logging";
import { runApp } from "#core/server";

import EmailService from "#core/services/EmailService";
import NewsletterService from "#core/services/NewsletterService";
import ContactsService from "#core/services/ContactsService";
import SegmentService from "#core/services/SegmentService";

import Segment from "#models/Segment";
import SegmentOngoingEmail from "#models/SegmentOngoingEmail";
import SegmentContact from "#models/SegmentContact";

const log = mainLogger.child({ app: "process-segments" });

async function processSegment(segment: Segment) {
  log.info("Process segment " + segment.name);

  const matchedContacts = await SegmentService.getSegmentContacts(segment);

  const segmentContacts = await getRepository(SegmentContact).find({
    where: { segmentId: segment.id }
  });

  const newContacts = matchedContacts.filter((m) =>
    segmentContacts.every((sm) => sm.contactId !== m.id)
  );
  const oldSegmentContactIds = segmentContacts
    .filter((sm) => matchedContacts.every((m) => m.id !== sm.contactId))
    .map((sm) => sm.contactId);

  log.info(
    `Segment ${segment.name} has ${segmentContacts.length} existing contacts, ${newContacts.length} new contacts and ${oldSegmentContactIds.length} old contacts`
  );

  await getRepository(SegmentContact).delete({
    segmentId: segment.id,
    contactId: In(oldSegmentContactIds)
  });
  await getRepository(SegmentContact).insert(
    newContacts.map((contact) => ({ segment, contact }))
  );

  const outgoingEmails = await getRepository(SegmentOngoingEmail).find({
    where: { segmentId: segment.id },
    relations: { email: true }
  });

  // Only fetch old contacts if we need to
  const oldContacts =
    segment.newsletterTag ||
    outgoingEmails.some((oe) => oe.trigger === "onLeave")
      ? await ContactsService.findByIds(oldSegmentContactIds)
      : [];

  for (const outgoingEmail of outgoingEmails) {
    const emailContacts =
      outgoingEmail.trigger === "onLeave"
        ? oldContacts
        : outgoingEmail.trigger === "onJoin"
          ? newContacts
          : [];
    if (emailContacts.length > 0) {
      await EmailService.sendEmailToContact(outgoingEmail.email, emailContacts);
    }
  }

  if (segment.newsletterTag) {
    await NewsletterService.addTagToContacts(
      newContacts,
      segment.newsletterTag
    );
    await NewsletterService.removeTagFromContacts(
      oldContacts,
      segment.newsletterTag
    );
  }
}

async function main(segmentId?: string) {
  let segments: Segment[];
  if (segmentId) {
    const segment = await getRepository(Segment).findOneBy({ id: segmentId });
    if (segment) {
      segments = [segment];
    } else {
      log.info(`Segment ${segmentId} not found`);
      return;
    }
  } else {
    segments = await getRepository(Segment).find();
  }

  for (const segment of segments) {
    await processSegment(segment);
  }
}

runApp(async () => {
  await main(process.argv[2]);
});

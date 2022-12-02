import "module-alias/register";

import { getRepository, In } from "typeorm";

import * as db from "@core/database";
import { log as mainLogger } from "@core/logging";

import EmailService from "@core/services/EmailService";
import NewsletterService from "@core/services/NewsletterService";
import ContactsService from "@core/services/ContactsService";
import SegmentService from "@core/services/SegmentService";

import Contact from "@models/Contact";
import Segment from "@models/Segment";
import SegmentOngoingEmail from "@models/SegmentOngoingEmail";
import SegmentContact from "@models/SegmentContact";

const log = mainLogger.child({ app: "process-segments" });

async function processSegment(segment: Segment) {
  log.info("Process segment " + segment.name);

  const matchedMembers = await SegmentService.getSegmentContacts(segment);

  const segmentMembers = (await getRepository(SegmentContact).find({
    where: { segment },
    loadRelationIds: true
  })) as unknown as WithRelationIds<SegmentContact, "member">[];

  const newMembers = matchedMembers.filter((m) =>
    segmentMembers.every((sm) => sm.member !== m.id)
  );
  const oldSegmentMembers = segmentMembers.filter((sm) =>
    matchedMembers.every((m) => m.id !== sm.member)
  );

  log.info(
    `Segment ${segment.name} has ${segmentMembers.length} existing members, ${newMembers.length} new members and ${oldSegmentMembers.length} old members`
  );

  await getRepository(SegmentContact).delete({
    segment,
    member: In(oldSegmentMembers.map((sm) => sm.member as unknown as Contact)) // Types seem strange here
  });
  await getRepository(SegmentContact).insert(
    newMembers.map((member) => ({
      segment,
      member
    }))
  );

  const outgoingEmails = await getRepository(SegmentOngoingEmail).find({
    where: { segment },
    relations: ["email"]
  });

  // Only fetch old members if we need to
  const oldMembers =
    segment.newsletterTag ||
    outgoingEmails.some((oe) => oe.trigger === "onLeave")
      ? await ContactsService.findByIds(
          oldSegmentMembers.map((sm) => sm.member)
        )
      : [];

  for (const outgoingEmail of outgoingEmails) {
    const emailMembers =
      outgoingEmail.trigger === "onLeave"
        ? oldMembers
        : outgoingEmail.trigger === "onJoin"
        ? newMembers
        : [];
    if (emailMembers.length > 0) {
      await EmailService.sendEmailToContact(outgoingEmail.email, emailMembers);
    }
  }

  if (segment.newsletterTag) {
    await NewsletterService.addTagToContacts(newMembers, segment.newsletterTag);
    await NewsletterService.removeTagFromContacts(
      oldMembers,
      segment.newsletterTag
    );
  }
}

async function main(segmentId?: string) {
  let segments: Segment[];
  if (segmentId) {
    const segment = await getRepository(Segment).findOne(segmentId);
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

db.connect().then(async () => {
  try {
    await main(process.argv[2]);
  } catch (error) {
    log.error("Unexpected error", error);
  }
  await db.close();
});

import { NewsletterStatus } from "@beabee/beabee-common";
import express from "express";
import moment from "moment";

import { log as mainLogger } from "@core/logging";
import { isSuperAdmin } from "@core/middleware";
import { wrapAsync } from "@core/utils";

import ContactsService from "@core/services/ContactsService";
import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";

import { NewsletterMember } from "@core/providers/newsletter";

import Contact from "@models/Contact";

import config from "@config";

const log = mainLogger.child({ app: "newsletter-settings" });

const app = express();

app.set("views", __dirname + "/views");

app.use(isSuperAdmin);

app.get("/", (req, res) => {
  res.render("index", { provider: config.newsletter.provider });
});

async function setResyncStatus(message: string) {
  log.info("Resync status: " + message);
  await OptionsService.set(
    "newsletter-resync-status",
    `[${moment.utc().format("HH:mm DD/MM")}] ${message}`
  );
}

function groupsList(groups: string[]) {
  return groups
    .slice()
    .sort((a, b) => (a < b ? -1 : 1))
    .join(",");
}

function isMismatchedMember(member: Contact, nlMember: NewsletterMember) {
  return (
    member.profile.newsletterStatus !== nlMember.status ||
    groupsList(member.profile.newsletterGroups) !==
      groupsList(nlMember.groups) ||
    !!member.membership?.isActive !==
      nlMember.tags.includes(
        OptionsService.getText("newsletter-active-member-tag")
      )
  );
}

interface ReportData {
  uploadIds: string[];
  imports: {
    email: string;
    status: string;
    groups: string[];
  }[];
  mismatched: {
    id: string;
    status: string;
    groups: string[];
    tags: string[];
  }[];
}

async function handleResync(
  statusSource: "ours" | "theirs",
  dryRun: boolean,
  removeUnsubscribed: boolean
) {
  try {
    await setResyncStatus("In progress: Fetching contact lists");

    const members = await ContactsService.find({ relations: ["profile"] });
    const newsletterMembers = await NewsletterService.getNewsletterMembers();

    const newMembersToUpload: Contact[] = [],
      existingMembers: Contact[] = [],
      existingMembersToArchive: Contact[] = [],
      mismatchedMembers: [Contact, NewsletterMember][] = [];
    for (const member of members) {
      const nlMember = newsletterMembers.find(
        (nm) => nm.email === member.email
      );
      if (nlMember) {
        existingMembers.push(member);

        const status =
          statusSource === "ours"
            ? member.profile.newsletterStatus
            : nlMember.status;
        if (status === NewsletterStatus.Unsubscribed && removeUnsubscribed) {
          existingMembersToArchive.push(member);
        }

        if (isMismatchedMember(member, nlMember)) {
          mismatchedMembers.push([member, nlMember]);
        }
      } else if (
        member.profile.newsletterStatus === NewsletterStatus.Subscribed
      ) {
        newMembersToUpload.push(member);
      }
    }

    const newsletterMembersToImport = newsletterMembers.filter((nm) =>
      members.every((m) => m.email !== nm.email)
    );

    await OptionsService.set(
      "newsletter-resync-data",
      JSON.stringify({
        uploadIds: newMembersToUpload.map((m) => m.id),
        imports: newsletterMembersToImport.map((m) => ({
          email: m.email,
          status: m.status,
          groups: m.groups
        })),
        mismatched: mismatchedMembers.map(([m, nlm]) => ({
          id: m.id,
          status: nlm.status,
          groups: nlm.groups,
          tags: nlm.tags
        }))
      } as ReportData)
    );

    if (dryRun) {
      await setResyncStatus(
        `DRY RUN: Successfully synced all contacts. ${newsletterMembersToImport.length} imported, ${mismatchedMembers.length} fixed, ${existingMembersToArchive.length} archived and ${newMembersToUpload.length} newly uploaded`
      );
      return;
    }

    await setResyncStatus(
      `In progress: Uploading ${newMembersToUpload.length} new contacts to the newsletter list`
    );
    await NewsletterService.upsertContacts(newMembersToUpload);

    // Must fix status before mass update to avoid overwriting in the wrong direction
    if (statusSource === "theirs") {
      await setResyncStatus(
        `In progress: Fixing ${mismatchedMembers.length} mismatched contacts`
      );

      for (const [member, nlMember] of mismatchedMembers) {
        await ContactsService.updateContactProfile(
          member,
          {
            newsletterStatus: nlMember.status,
            newsletterGroups: nlMember.groups
          },
          { sync: false }
        );
      }
    }

    await setResyncStatus(
      `In progress: Updating ${existingMembers.length} contacts in newsletter list`
    );
    await NewsletterService.upsertContacts(existingMembers);

    // Sync tags before archiving
    await setResyncStatus(
      `In progress: Updating active member tag for ${mismatchedMembers.length} contacts in newsletter list`
    );

    await NewsletterService.addTagToContacts(
      mismatchedMembers.filter(([m]) => m.membership?.isActive).map(([m]) => m),
      OptionsService.getText("newsletter-active-member-tag")
    );
    await NewsletterService.removeTagFromContacts(
      mismatchedMembers
        .filter(([m]) => !m.membership?.isActive)
        .map(([m]) => m),
      OptionsService.getText("newsletter-active-member-tag")
    );

    // TODO: Check other tags

    await setResyncStatus(
      `In progress: Archiving ${existingMembersToArchive.length} contacts from newsletter list`
    );
    await NewsletterService.archiveContacts(existingMembersToArchive);

    await setResyncStatus(
      `In progress: Importing ${newsletterMembersToImport.length} contacts from newsletter list`
    );

    for (const nlMember of newsletterMembersToImport) {
      await ContactsService.createContact(
        {
          email: nlMember.email,
          firstname: nlMember.firstname,
          lastname: nlMember.lastname,
          joined: nlMember.joined
        },
        {
          newsletterStatus: nlMember.status,
          newsletterGroups: nlMember.groups
        },
        { sync: false }
      );
    }

    await setResyncStatus(
      `Successfully synced all contacts. ${newsletterMembersToImport.length} imported, ${mismatchedMembers.length} fixed, ${existingMembersToArchive.length} archived and ${newMembersToUpload.length} newly uploaded`
    );
  } catch (error: any) {
    log.error("Newsletter sync failed", error);
    await setResyncStatus("Error: " + error.message);
  }
}

app.post(
  "/",
  wrapAsync(async (req, res) => {
    if (req.body.action === "resync") {
      await setResyncStatus("In progress: initialising resync");
      req.flash("success", "newsletter-resync-started");
      res.redirect(req.originalUrl);

      handleResync(
        req.body.statusSource,
        req.body.dryRun === "true",
        req.body.removeUnsubscribed === "true"
      );
    }
  })
);

app.get(
  "/report",
  wrapAsync(async (req, res) => {
    const data = OptionsService.getJSON("newsletter-resync-data") as ReportData;
    const newMembersToUpload = await ContactsService.findByIds(data.uploadIds);
    const mismatchedMembers = await ContactsService.findByIds(
      data.mismatched.map((m) => m.id),
      { relations: ["profile"] }
    );

    res.render("report", {
      contactsToImport: data.imports,
      newMembersToUpload,
      mismatchedMembers: data.mismatched.map((m) => ({
        ...m,
        member: mismatchedMembers.find((m2) => m.id === m2.id)
      }))
    });
  })
);

export default app;

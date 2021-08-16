import express from "express";
import moment from "moment";

import { log as mainLogger } from "@core/logging";
import { isSuperAdmin } from "@core/middleware";
import { ContributionType, wrapAsync } from "@core/utils";

import MembersService from "@core/services/MembersService";
import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";

import { NewsletterMember, NewsletterStatus } from "@core/providers/newsletter";

import Member from "@models/Member";

import config from "@config";

const log = mainLogger.child({ app: "newsletter-settings" });

const app = express();

app.set("views", __dirname + "/views");

app.use(isSuperAdmin);

app.get("/", (req, res) => {
  res.render("index", { provider: config.newsletter.provider });
});

async function setResyncStatus(message: string) {
  log.info({ action: "resync-status", data: { message } });
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

function isMismatchedMember(member: Member, nlMember: NewsletterMember) {
  return (
    member.profile.newsletterStatus !== nlMember.status ||
    groupsList(member.profile.newsletterGroups) !== groupsList(nlMember.groups)
  );
}

async function handleResync(statusSource: "ours" | "theirs", dryRun: boolean) {
  try {
    await setResyncStatus("In progress: Fetching contact lists");

    const members = await MembersService.find({ relations: ["profile"] });
    const newsletterMembers = await NewsletterService.getNewsletterMembers();

    const newMembersToUpload = [],
      existingMembers = [],
      existingMembersToArchive = [],
      mismatchedMembers = [];
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
        if (status === NewsletterStatus.Unsubscribed) {
          existingMembersToArchive.push(member);
        }

        if (isMismatchedMember(member, nlMember)) {
          mismatchedMembers.push([member, nlMember] as const);
        }
      } else if (
        member.profile.newsletterStatus !== NewsletterStatus.Unsubscribed
      ) {
        newMembersToUpload.push(member);
      }
    }
    const newsletterMembersToImport = newsletterMembers.filter((nm) =>
      members.every((m) => m.email !== nm.email)
    );

    if (dryRun) {
      await setResyncStatus(
        `DRY RUN: Successfully synced all contacts. ${newsletterMembersToImport.length} imported, ${mismatchedMembers.length} fixed and ${newMembersToUpload.length} newly uploaded`
      );
      return;
    }

    await setResyncStatus(
      `In progress: Uploading ${newMembersToUpload.length} new contacts to the newsletter list`
    );
    await NewsletterService.insertMembers(newMembersToUpload);

    await setResyncStatus(
      `In progress: Updating ${existingMembers.length} existing contacts in newsletter list`
    );
    await NewsletterService.updateMembers(existingMembers);

    await setResyncStatus(
      `In progress: Archiving ${existingMembersToArchive.length} contacts from newsletter list`
    );
    await NewsletterService.archiveMembers(existingMembersToArchive);

    await setResyncStatus(
      `In progress: Fixing ${mismatchedMembers.length} mismatched contacts`
    );

    if (statusSource === "theirs") {
      for (const [member, nlMember] of mismatchedMembers) {
        await MembersService.updateMemberProfile(
          member,
          {
            newsletterStatus: nlMember.status,
            newsletterGroups: nlMember.groups
          },
          { noSync: true }
        );
      }
    } else {
      await NewsletterService.updateMemberStatuses(
        mismatchedMembers.map(([m]) => m)
      );
    }

    await setResyncStatus(
      `In progress: Importing ${newsletterMembersToImport.length} contacts from newsletter list`
    );

    for (const nlMember of newsletterMembersToImport) {
      await MembersService.createMember(
        {
          email: nlMember.email,
          firstname: nlMember.firstname,
          lastname: nlMember.lastname,
          contributionType: ContributionType.None
        },
        {
          newsletterStatus: nlMember.status,
          newsletterGroups: nlMember.groups
        },
        { noSync: true }
      );
    }

    // TODO: Check tags

    await setResyncStatus(
      `Successfully synced all contacts. ${newsletterMembersToImport.length} imported, ${mismatchedMembers.length} fixed and ${newMembersToUpload.length} newly uploaded`
    );
  } catch (error) {
    log.error(
      {
        action: "newsletter-sync-error",
        error
      },
      "Newsletter sync failed"
    );
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

      handleResync(req.body.statusSource, req.body.dryRun === "true");
    }
  })
);

export default app;

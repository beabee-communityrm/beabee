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

function isMismatchedMember(member: Member, nlMember: NewsletterMember) {
  return (
    member.profile.newsletterStatus !== nlMember.status ||
    groupsList(member.profile.newsletterGroups) !== groupsList(nlMember.groups)
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
  }[];
}

async function handleResync(
  statusSource: "ours" | "theirs",
  dryRun: boolean,
  removeUnsubscribed: boolean
) {
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
        if (status === NewsletterStatus.Unsubscribed && removeUnsubscribed) {
          existingMembersToArchive.push(member);
        }

        if (isMismatchedMember(member, nlMember)) {
          mismatchedMembers.push([member, nlMember] as const);
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

    const membersInNewsletter = [...existingMembers, ...newMembersToUpload];

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
          groups: nlm.groups
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
    await NewsletterService.upsertMembers(newMembersToUpload);

    // Must fix status before mass update to avoid overwriting in the wrong direction
    if (statusSource === "theirs") {
      await setResyncStatus(
        `In progress: Fixing ${mismatchedMembers.length} mismatched contacts`
      );

      for (const [member, nlMember] of mismatchedMembers) {
        await MembersService.updateMemberProfile(
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
    await NewsletterService.upsertMembers(existingMembers);

    // Sync tags before archiving
    await setResyncStatus(
      `In progress: Updating active member tag for ${membersInNewsletter.length} contacts in newsletter list`
    );

    await NewsletterService.addTagToMembers(
      membersInNewsletter.filter((m) => m.isActiveMember),
      OptionsService.getText("newsletter-active-member-tag")
    );
    await NewsletterService.removeTagFromMembers(
      membersInNewsletter.filter((m) => !m.isActiveMember),
      OptionsService.getText("newsletter-active-member-tag")
    );

    // TODO: Check other tags

    await setResyncStatus(
      `In progress: Archiving ${existingMembersToArchive.length} contacts from newsletter list`
    );
    await NewsletterService.archiveMembers(existingMembersToArchive);

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
        { sync: false }
      );
    }

    await setResyncStatus(
      `Successfully synced all contacts. ${newsletterMembersToImport.length} imported, ${mismatchedMembers.length} fixed, ${existingMembersToArchive.length} archived and ${newMembersToUpload.length} newly uploaded`
    );
  } catch (error) {
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
    const newMembersToUpload = await MembersService.findByIds(data.uploadIds);
    const mismatchedMembers = await MembersService.findByIds(
      data.mismatched.map((m) => m.id),
      { relations: ["profile"] }
    );

    res.render("report", {
      contactsToImport: data.imports,
      newMembersToUpload,
      mismatchedMembers: data.mismatched.map((m) => ({
        member: mismatchedMembers.find((m2) => m.id === m2.id),
        status: m.status,
        groups: m.groups
      }))
    });
  })
);

export default app;

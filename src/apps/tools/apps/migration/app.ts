import express from "express";
import { getRepository } from "typeorm";

import { isAdmin } from "@core/middleware";
import { ContributionPeriod, ContributionType, wrapAsync } from "@core/utils";

import EmailService from "@core/services/EmailService";
import MembersService from "@core/services/MembersService";

import ResetPasswordFlow from "@models/ResetPasswordFlow";

import { schemaToEmail } from "@apps/tools/apps/emails/app";

import config from "@config";
import _ from "lodash";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get("/", (req, res) => {
  res.render("index");
});

async function getManualMembers() {
  const manualMembers = await MembersService.find({
    where: { contributionType: ContributionType.Manual }
  });

  const activeMembers = manualMembers.filter((m) => m.membership?.isActive);

  const expiringMembers = activeMembers.filter(
    (m) => m.membership?.dateExpires
  );

  const nonExpiringMonthlyMembers = activeMembers.filter(
    (member) =>
      member.contributionPeriod === ContributionPeriod.Monthly &&
      !member.membership?.dateExpires
  );

  const nonExpiringAnnualMembers = activeMembers.filter(
    (member) =>
      member.contributionPeriod === ContributionPeriod.Annually &&
      !member.membership?.dateExpires
  );

  return {
    expiringMembers,
    nonExpiringMonthlyMembers,
    nonExpiringAnnualMembers
  };
}

app.get(
  "/manual-to-gc",
  wrapAsync(async (req, res) => {
    const {
      expiringMembers,
      nonExpiringMonthlyMembers,
      nonExpiringAnnualMembers
    } = await getManualMembers();

    res.render("manual-to-gc", {
      expiringMembers: expiringMembers.length,
      nonExpiringMonthlyMembers: nonExpiringMonthlyMembers.length,
      nonExpiringAnnualMembers: nonExpiringAnnualMembers.length
    });
  })
);

app.post(
  "/manual-to-gc",
  wrapAsync(async (req, res) => {
    const {
      expiringMembers,
      nonExpiringMonthlyMembers,
      nonExpiringAnnualMembers
    } = await getManualMembers();

    const [membersWithPassword, membersWithoutPassword] = _.partition(
      [
        ...expiringMembers,
        ...nonExpiringMonthlyMembers,
        ...nonExpiringAnnualMembers
      ],
      (member) => member.password.hash
    );

    const rpFlows = await getRepository(ResetPasswordFlow).save(
      membersWithoutPassword.map((member) => ({ member }))
    );

    const nextParam = "?next=" + encodeURIComponent("/profile/contribution");

    const recipients = [
      ...membersWithPassword.map((member) =>
        EmailService.memberToRecipient(member, {
          CONVERTLINK: `${config.audience}/auth/login${nextParam}`
        })
      ),
      ...rpFlows.map((rpFlow) =>
        EmailService.memberToRecipient(rpFlow.member, {
          CONVERTLINK: `${config.audience}/auth/set-password/${rpFlow.id}${nextParam}`
        })
      )
    ];

    const email = schemaToEmail({ ...req.body, name: "" });
    await EmailService.sendEmail(email, recipients);

    req.flash("success", "migration-manual-to-gc-sent");
    res.redirect("/tools/migration/manual-to-gc");
  })
);

export default app;

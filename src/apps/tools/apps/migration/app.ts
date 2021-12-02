import express from "express";

import { isAdmin } from "@core/middleware";
import { ContributionPeriod, ContributionType, wrapAsync } from "@core/utils";

import MembersService from "@core/services/MembersService";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get("/", (req, res) => {
  res.render("index");
});

app.get(
  "/manual-to-gc",
  wrapAsync(async (req, res) => {
    const manualMembers = await MembersService.find({
      where: { contributionType: ContributionType.Manual }
    });

    const expiringMembers = manualMembers.filter(
      (m) => m.membershipExpires
    ).length;

    const nonExpiringMonthlyMembers = manualMembers.filter(
      (member) =>
        member.contributionPeriod === ContributionPeriod.Monthly &&
        !member.membershipExpires
    ).length;

    const nonExpiringAnnualMembers = manualMembers.filter(
      (member) =>
        member.contributionPeriod === ContributionPeriod.Annually &&
        !member.membershipExpires
    ).length;

    const convertableMembers = expiringMembers + nonExpiringMonthlyMembers;

    res.render("manual-to-gc", {
      manualMembers,
      expiringMembers,
      nonExpiringMonthlyMembers,
      nonExpiringAnnualMembers,
      convertableMembers
    });
  })
);

app.post(
  "/manual-to-gc",
  wrapAsync(async (req, res) => {
    res.redirect("/tools/migration/manual-to-gc");
  })
);

export default app;

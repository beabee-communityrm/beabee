import express from "express";

import { ContributionType, wrapAsync } from "@core/utils";
import { calcMonthsLeft } from "@core/utils/payment";

import PaymentService from "@core/services/PaymentService";
import MembersService from "@core/services/MembersService";

import Member from "@models/Member";

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const member = req.model as Member;
    if (member.contributionType === ContributionType.Automatic) {
      const payments = await PaymentService.getPayments(member);

      const successfulPayments = payments
        .filter((p) => p.isSuccessful)
        .map((p) => p.amount - (p.amountRefunded || 0))
        .filter((amount) => !isNaN(amount));

      const total = successfulPayments.reduce((a, b) => a + b, 0);

      res.render("automatic", {
        member: req.model,
        canChange: await PaymentService.canChangeContribution(member, true),
        monthsLeft: calcMonthsLeft(member),
        payments,
        total
      });
    } else if (
      member.contributionType === ContributionType.Manual ||
      member.contributionType === ContributionType.None
    ) {
      res.render("manual", { member: req.model });
    } else {
      res.render("none", { member: req.model });
    }
  })
);

app.post(
  "/",
  wrapAsync(async (req, res) => {
    const member = req.model as Member;

    switch (req.body.action) {
      case "update-subscription":
        await MembersService.updateMemberContribution(member, {
          monthlyAmount: Number(req.body.amount),
          period: req.body.period,
          prorate: req.body.prorate === "true",
          payFee: req.body.payFee === "true"
        });
        req.flash("success", "contribution-updated");
        break;

      case "cancel-subscription":
        await MembersService.cancelMemberContribution(
          member,
          "cancelled-contribution"
        );
        break;

      case "force-update":
        await MembersService.updateMember(member, {
          contributionType: req.body.type,
          contributionMonthlyAmount: req.body.amount
            ? Number(req.body.amount)
            : null,
          contributionPeriod: req.body.period
        });

        if (req.body.type === ContributionType.Manual) {
          await PaymentService.updateDataBy(
            member,
            "source",
            req.body.source || null
          );
          await PaymentService.updateDataBy(
            member,
            "reference",
            req.body.reference || null
          );
        }
        req.flash("success", "contribution-updated");
        break;
    }

    res.redirect(req.originalUrl);
  })
);

export default app;

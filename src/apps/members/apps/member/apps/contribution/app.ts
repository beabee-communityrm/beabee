import express from "express";
import { getRepository } from "typeorm";

import { ContributionType, wrapAsync } from "@core/utils";

import EmailService from "@core/services/EmailService";
import GCPaymentService from "@core/services/GCPaymentService";
import MembersService from "@core/services/MembersService";

import GCPaymentData from "@models/GCPaymentData";
import ManualPaymentData from "@models/ManualPaymentData";
import Member from "@models/Member";

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const member = req.model as Member;
    if (member.contributionType === ContributionType.GoCardless) {
      const payments = await GCPaymentService.getPayments(member);

      const successfulPayments = payments
        .filter((p) => p.isSuccessful)
        .map((p) => p.amount - (p.amountRefunded || 0))
        .filter((amount) => !isNaN(amount));

      const total = successfulPayments.reduce((a, b) => a + b, 0);

      res.render("gocardless", {
        member: req.model,
        canChange: await GCPaymentService.canChangeContribution(member, true),
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
        await GCPaymentService.updateContribution(member, {
          monthlyAmount: Number(req.body.amount),
          period: req.body.period,
          prorate: req.body.prorate === "true",
          payFee: req.body.payFee === "true"
        });
        req.flash("success", "contribution-updated");
        break;

      case "cancel-subscription":
        await GCPaymentService.cancelContribution(member);
        await EmailService.sendTemplateToMember(
          "cancelled-contribution",
          member
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
        if (req.body.type === ContributionType.GoCardless) {
          await getRepository(GCPaymentData).save({
            member,
            customerId: req.body.customerId,
            mandateId: req.body.mandateId,
            subscriptionId: req.body.subscriptionId,
            payFee: req.body.payFee === "true"
          });
        } else if (req.body.type === ContributionType.Manual) {
          await getRepository(ManualPaymentData).save({
            member,
            source: req.body.source || "",
            reference: req.body.reference || ""
          });
        }
        req.flash("success", "contribution-updated");
        break;
    }

    res.redirect(req.originalUrl);
  })
);

export default app;

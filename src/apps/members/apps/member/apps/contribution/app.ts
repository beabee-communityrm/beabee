import express from "express";
import { getRepository } from "typeorm";

import { isSuperAdmin } from "@core/middleware";
import { ContributionType, PaymentMethod, wrapAsync } from "@core/utils";

import EmailService from "@core/services/EmailService";
import GCPaymentService from "@core/services/GCPaymentService";
import MembersService from "@core/services/MembersService";

import GCPaymentData from "@models/GCPaymentData";
import ManualPaymentData from "@models/ManualPaymentData";
import Member from "@models/Member";

const app = express();

app.set("views", __dirname + "/views");

app.use(isSuperAdmin);

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const member = req.model as Member;
    if (member.contributionType === ContributionType.GoCardless) {
      const payments = await GCPaymentService.getPayments(member);

      const successfulPayments = payments
        .filter((p) => p.isSuccessful)
        .map((p) => p.amount - p.amountRefunded)
        .filter((amount) => !isNaN(amount));

      const total = successfulPayments.reduce((a, b) => a + b, 0);

      res.render("gocardless", {
        member: req.model,
        canChange: await GCPaymentService.canChangeContribution(member, true),
        payments,
        total
      });
    } else if (member.contributionType === ContributionType.Manual) {
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
          payFee: req.body.payFee === "true",
          paymentMethod: PaymentMethod.DirectDebit
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
          contributionMonthlyAmount: Number(req.body.amount),
          contributionPeriod: req.body.period
        });
        await getRepository(GCPaymentData).update(member.id, {
          customerId: req.body.customerId,
          mandateId: req.body.mandateId,
          subscriptionId: req.body.subscriptionId,
          payFee: req.body.payFee === "true"
        });

        req.flash("success", "gocardless-updated");
        break;

      case "update-manual-subscription":
        await MembersService.updateMember(member, {
          contributionMonthlyAmount: Number(req.body.amount),
          contributionPeriod: req.body.period
        });
        await getRepository(ManualPaymentData).update(member.id, {
          source: req.body.source || "",
          reference: req.body.reference || ""
        });
        req.flash("success", "contribution-updated");
        break;
    }

    res.redirect(req.originalUrl);
  })
);

export default app;

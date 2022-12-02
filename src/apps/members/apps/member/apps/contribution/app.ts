import { ContributionType } from "@beabee/beabee-common";
import express from "express";

import { wrapAsync } from "@core/utils";
import { calcMonthsLeft } from "@core/utils/payment";

import PaymentService from "@core/services/PaymentService";
import ContactsService from "@core/services/ContactsService";

import Contact from "@models/Contact";

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const member = req.model as Contact;
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
    const member = req.model as Contact;

    switch (req.body.action) {
      case "update-subscription":
        await ContactsService.updateContactContribution(member, {
          monthlyAmount: Number(req.body.amount),
          period: req.body.period,
          prorate: req.body.prorate === "true",
          payFee: req.body.payFee === "true"
        });
        req.flash("success", "contribution-updated");
        break;

      case "cancel-subscription":
        await ContactsService.cancelContactContribution(
          member,
          "cancelled-contribution"
        );
        break;

      case "force-update":
        await ContactsService.forceUpdateContactContribution(member, {
          type: req.body.type,
          amount: req.body.amount,
          period: req.body.period,
          source: req.body.source,
          reference: req.body.reference
        });

        req.flash("success", "contribution-updated");
        break;
    }

    res.redirect(req.originalUrl);
  })
);

export default app;

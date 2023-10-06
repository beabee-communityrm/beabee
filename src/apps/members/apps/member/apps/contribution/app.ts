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
    const contact = req.model as Contact;
    if (contact.contributionType === ContributionType.Automatic) {
      const payments = await PaymentService.getPayments(contact);

      const successfulPayments = payments
        .filter((p) => p.isSuccessful)
        .map((p) => p.amount - (p.amountRefunded || 0))
        .filter((amount) => !isNaN(amount));

      const total = successfulPayments.reduce((a, b) => a + b, 0);

      res.render("automatic", {
        member: contact,
        canChange: true, // TODO: remove
        monthsLeft: calcMonthsLeft(contact),
        payments,
        total
      });
    } else if (
      contact.contributionType === ContributionType.Manual ||
      contact.contributionType === ContributionType.None
    ) {
      res.render("manual", { member: contact });
    } else {
      res.render("none", { member: contact });
    }
  })
);

app.post(
  "/",
  wrapAsync(async (req, res) => {
    const contact = req.model as Contact;

    switch (req.body.action) {
      case "update-subscription":
        await ContactsService.updateContactContribution(contact, {
          monthlyAmount: Number(req.body.amount),
          period: req.body.period,
          prorate: req.body.prorate === "true",
          payFee: req.body.payFee === "true"
        });
        req.flash("success", "contribution-updated");
        break;

      case "cancel-subscription":
        await ContactsService.cancelContactContribution(
          contact,
          "cancelled-contribution"
        );
        break;

      case "force-update":
        await ContactsService.forceUpdateContactContribution(contact, {
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

import express from "express";
import moment from "moment";
import { getRepository } from "typeorm";

import config from "@config";

import { isAdmin } from "@core/middleware";
import { wrapAsync } from "@core/utils";
import { canSuperAdmin, generateCode } from "@core/utils/auth";

import ContactsService from "@core/services/ContactsService";
import OptionsService from "@core/services/OptionsService";
import PaymentService from "@core/services/PaymentService";
import ReferralsService from "@core/services/ReferralsService";

import Contact from "@models/Contact";
import ResetPasswordFlow from "@models/ResetPasswordFlow";

const app = express();

async function getAvailableTags(): Promise<string[]> {
  return OptionsService.getList("available-tags");
}

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.use(
  wrapAsync(async (req, res, next) => {
    // Bit of a hack to get parent app params
    const contact = await ContactsService.findOne({
      where: { id: req.allParams.uuid },
      relations: ["profile"]
    });
    if (contact) {
      req.model = contact;
      const { data, method } = await PaymentService.getData(contact);
      res.locals.paymentData = data;
      res.locals.paymentMethod = method;
      next();
    } else {
      next("route");
    }
  })
);

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const contact = req.model as Contact;
    const availableTags = await getAvailableTags();

    const rpFlow = await getRepository(ResetPasswordFlow).findOne({
      where: { contact: contact },
      order: { date: "DESC" }
    });

    res.render("index", {
      member: contact,
      rpFlow,
      availableTags,
      password_tries: config.passwordTries
    });
  })
);

app.post(
  "/",
  wrapAsync(async (req, res) => {
    const contact = req.model as Contact;

    if (!req.body.action.startsWith("save-") && !canSuperAdmin(req)) {
      req.flash("error", "403");
      res.redirect(req.baseUrl);
      return;
    }

    switch (req.body.action) {
      case "save-about": {
        await ContactsService.updateContactProfile(contact, {
          tags: req.body.tags || [],
          description: req.body.description || "",
          bio: req.body.bio || ""
        });
        req.flash("success", "member-updated");
        break;
      }
      case "save-contact":
        await ContactsService.updateContact(contact, {
          email: req.body.email
        });
        await ContactsService.updateContactProfile(contact, {
          telephone: req.body.telephone || "",
          twitter: req.body.twitter || "",
          preferredContact: req.body.preferred || ""
        });
        req.flash("success", "member-updated");
        break;
      case "save-notes":
        await ContactsService.updateContactProfile(contact, {
          notes: req.body.notes
        });
        req.flash("success", "member-updated");
        break;
      case "login-override":
        await ContactsService.updateContact(contact, {
          loginOverride: {
            code: generateCode(),
            expires: moment().add(24, "hours").toDate()
          }
        });
        req.flash("success", "member-login-override-generated");
        break;
      case "password-reset":
        await getRepository(ResetPasswordFlow).save({ contact });
        req.flash("success", "member-password-reset-generated");
        break;
      case "permanently-delete":
        // TODO: anonymise data in callout answers

        await ReferralsService.permanentlyDeleteContact(contact);
        await PaymentService.permanentlyDeleteContact(contact);

        await ContactsService.permanentlyDeleteContact(contact);

        req.flash("success", "member-permanently-deleted");
        res.redirect("/members");
        return;
    }

    res.redirect(req.baseUrl);
  })
);

export default app;

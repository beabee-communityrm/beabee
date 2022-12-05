import {
  ContributionPeriod,
  ContributionType,
  NewsletterStatus,
  PermissionType
} from "@beabee/beabee-common";
import express from "express";
import { getRepository } from "typeorm";

import { hasSchema, isSuperAdmin } from "@core/middleware";
import { createDateTime, wrapAsync } from "@core/utils";

import ContactsService from "@core/services/ContactsService";
import OptionsService from "@core/services/OptionsService";

import ContactRole from "@models/ContactRole";

import { addContactSchema } from "./schemas.json";

import DuplicateEmailError from "@api/errors/DuplicateEmailError";
import PaymentService from "@core/services/PaymentService";

interface BaseAddContactSchema {
  email: string;
  firstname?: string;
  lastname?: string;
  permissions?: {
    permission: PermissionType;
    startDate?: string;
    startTime?: string;
    expiryDate?: string;
    expiryTime?: string;
  }[];
  addToNewsletter?: boolean;
  addAnother?: boolean;
}

interface AddManualContactSchema extends BaseAddContactSchema {
  type: ContributionType.Manual;
  source?: string;
  reference?: string;
  amount?: number;
  period?: ContributionPeriod;
}

interface AddNoneContactScema extends BaseAddContactSchema {
  type: ContributionType.None;
}

type AddContactSchema = AddManualContactSchema | AddNoneContactScema;

const app = express();

app.set("views", __dirname + "/views");

app.use(isSuperAdmin);

app.get("/", (req, res) => {
  res.render("index");
});

app.post(
  "/",
  hasSchema(addContactSchema).orFlash,
  wrapAsync(async (req, res) => {
    const data = req.body as AddContactSchema;

    const permissions =
      data.permissions?.map((p) => {
        const dateAdded = createDateTime(p.startDate, p.startTime);
        return getRepository(ContactRole).create({
          type: p.permission,
          ...(dateAdded && { dateAdded }),
          dateExpires: createDateTime(p.expiryDate, p.expiryTime)
        });
      }) || [];

    let contact;
    try {
      contact = await ContactsService.createContact(
        {
          email: data.email,
          contributionType: data.type,
          firstname: data.firstname || "",
          lastname: data.lastname || "",
          roles: permissions
        },
        data.addToNewsletter
          ? {
              newsletterStatus: NewsletterStatus.Subscribed,
              newsletterGroups: OptionsService.getList(
                "newsletter-default-groups"
              )
            }
          : undefined
      );
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        req.flash("danger", "email-duplicate");
        res.redirect("/members/add");
        return;
      } else {
        throw error;
      }
    }

    if (data.type === ContributionType.Manual) {
      await PaymentService.updateDataBy(contact, "source", data.source || null);
      await PaymentService.updateDataBy(
        contact,
        "reference",
        data.reference || null
      );
      await ContactsService.updateContact(contact, {
        contributionPeriod: data.period || null,
        contributionMonthlyAmount: data.amount || null
      });
    }

    req.flash("success", "member-added");
    res.redirect(data.addAnother ? "/members/add" : "/members/" + contact.id);
  })
);

export default app;

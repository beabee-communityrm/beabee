import busboy from "connect-busboy";
import express from "express";
import _ from "lodash";
import Papa from "papaparse";
import { getRepository } from "typeorm";

import { hasNewModel, isAdmin } from "@core/middleware";
import { wrapAsync } from "@core/utils";

import EmailService from "@core/services/EmailService";

import Email from "@models/Email";
import EmailMailing, { EmailMailingRecipient } from "@models/EmailMailing";

const app = express();

export interface EmailSchema {
  name: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}

export function schemaToEmail(data: EmailSchema): Email {
  const email = new Email();
  email.name = data.name;
  email.fromName = data.fromName;
  email.fromEmail = data.fromEmail;
  email.subject = data.subject;
  email.body = data.body;

  return email;
}

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const emails = await getRepository(Email).find();
    res.render("index", { emails });
  })
);

app.post(
  "/",
  wrapAsync(async (req, res) => {
    const emails = await getRepository(Email).save(schemaToEmail(req.body));
    res.redirect("/tools/emails/" + emails.id);
  })
);

app.get(
  "/:id",
  hasNewModel(Email, "id"),
  wrapAsync(async (req, res) => {
    const mailings = await getRepository(EmailMailing).find({
      email: req.model as Email
    });

    res.render("email", { email: req.model, mailings });
  })
);

app.post(
  "/:id",
  hasNewModel(Email, "id"),
  wrapAsync(async (req, res) => {
    const email = req.model as Email;

    switch (req.body.action) {
      case "update":
        await getRepository(Email).update(email.id, schemaToEmail(req.body));
        req.flash("success", "transactional-email-updated");
        res.redirect(req.originalUrl);
        break;
      case "delete":
        await getRepository(EmailMailing).delete({ email });
        await getRepository(Email).delete(email.id);
        req.flash("success", "transactional-email-deleted");
        res.redirect("/tools/emails");
        break;
    }
  })
);

app.post("/:id/mailings", hasNewModel(Email, "id"), busboy(), (req, res) => {
  const email = req.model as Email;
  let recipients: EmailMailingRecipient[];

  req.busboy.on("file", (fieldname, file) => {
    Papa.parse(file, {
      header: true,
      complete: function (results) {
        recipients = results.data as EmailMailingRecipient[];
      }
    });
  });
  req.busboy.on("finish", async () => {
    const mailing = new EmailMailing();
    mailing.email = email;
    mailing.recipients = recipients;
    const savedMailing = await getRepository(EmailMailing).save(mailing);
    res.redirect(`/tools/emails/${email.id}/mailings/${savedMailing.id}`);
  });

  req.pipe(req.busboy);
});

app.get(
  "/:id/mailings/:mailingId",
  hasNewModel(Email, "id"),
  wrapAsync(async (req, res, next) => {
    const email = req.model as Email;
    const mailing = await getRepository(EmailMailing).findOne(
      req.params.mailingId
    );
    if (!mailing) return next("route");

    const matches = email.body.match(/\*\|[^|]+\|\*/g) || [];
    const mergeFields = _.uniq(
      matches.map((f) => f.substring(2, f.length - 2))
    );
    res.render("mailing", {
      email,
      mailing,
      mergeFields,
      headers: Object.keys(mailing.recipients[0]),
      onlyPreview: req.query.preview !== undefined
    });
  })
);

interface SendSchema {
  emailField: string;
  nameField: string;
  mergeFields: Record<string, string>;
}

app.post(
  "/:id/mailings/:mailingId",
  hasNewModel(Email, "id"),
  wrapAsync(async (req, res, next) => {
    const email = req.model as Email;
    const mailing = await getRepository(EmailMailing).findOne(
      req.params.mailingId
    );
    if (!mailing) return next("route");

    const { emailField, nameField, mergeFields }: SendSchema = req.body;

    const recipients = mailing.recipients.map((recipient) => ({
      to: {
        email: recipient[emailField],
        name: recipient[nameField]
      },
      mergeFields: _.mapValues(
        mergeFields,
        (valueField) => recipient[valueField]
      )
    }));

    await EmailService.sendEmail(email, recipients);

    await getRepository(EmailMailing).update(mailing.id, {
      sentDate: new Date(),
      emailField,
      nameField,
      mergeFields
    });

    req.flash("success", "transactional-email-sending");

    res.redirect(req.originalUrl);
  })
);

export default app;

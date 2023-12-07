import busboy from "connect-busboy";
import express from "express";
import _ from "lodash";
import Papa from "papaparse";

import { createQueryBuilder, getRepository } from "@core/database";
import { hasNewModel, isAdmin } from "@core/middleware";
import { wrapAsync } from "@core/utils";
import { formatEmailBody } from "@core/utils/email";

import EmailService from "@core/services/EmailService";
import OptionsService from "@core/services/OptionsService";

import Email from "@models/Email";
import EmailMailing, { EmailMailingRecipient } from "@models/EmailMailing";
import SegmentOngoingEmail from "@models/SegmentOngoingEmail";

const app = express();

export interface EmailSchema {
  name: string;
  fromName?: string;
  fromEmail?: string;
  subject: string;
  body: string;
}

export function schemaToEmail(data: EmailSchema): Email {
  const email = new Email();
  email.name = data.name;
  email.fromName = data.fromName || null;
  email.fromEmail = data.fromEmail || null;
  email.subject = data.subject;
  email.body = data.body;

  return email;
}

const assignableSystemEmails = {
  welcome: "Welcome",
  "reset-password": "Reset password",
  "reset-device": "Reset device",
  "cancelled-contribution": "Cancelled contribution",
  "cancelled-contribution-no-survey": "Cancelled contribution - no survey",
  "confirm-email": "Confirm email",
  "manual-to-automatic": "Manual contributor converted to automatic",
  "email-exists-login": "Email exists - login",
  "email-exists-set-password": "Email exists - set password",
  "new-member": "New contact notification",
  "cancelled-member": "Cancelled member notification",
  "new-callout-response": "New callout response notification"
};

function providerTemplateMap() {
  return OptionsService.getJSON("email-templates");
}

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const emails = await createQueryBuilder(Email, "e")
      .loadRelationCountAndMap("e.mailingCount", "e.mailings")
      .orderBy({ name: "ASC" })
      .getMany();

    const segmentEmails = await getRepository(SegmentOngoingEmail).find();
    const systemEmails = Object.values(providerTemplateMap());

    const emailsWithFlags = emails.map((email) => ({
      ...email,
      isSystem: systemEmails.indexOf(email.id) > -1,
      isSegment: segmentEmails.findIndex((se) => se.emailId === email.id) > -1
    }));

    res.render("index", { emails: emailsWithFlags });
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
    const email = req.model as Email;

    const mailings = await getRepository(EmailMailing).find({
      where: { emailId: email.id },
      order: { createdDate: "ASC" }
    });
    const segmentEmails = await getRepository(SegmentOngoingEmail).find({
      where: { emailId: email.id },
      relations: { segment: true }
    });
    const systemEmails = Object.entries(providerTemplateMap())
      .filter(([systemId, emailId]) => emailId === email.id)
      .map(([systemId]) => systemId);

    res.render("email", {
      email,
      mailings,
      segmentEmails,
      systemEmails,
      assignableSystemEmails
    });
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
      case "update-system-emails": {
        const newEmailTemplates = Object.assign(
          {},
          providerTemplateMap(),
          // Unassigned all triggers assigned to this email
          ...Object.entries(providerTemplateMap())
            .filter(([systemEmail, emailId]) => emailId === email.id)
            .map(([systemEmail]) => ({ [systemEmail]: undefined })),
          // (Re)assign the new trigger
          ...((req.body.systemEmails || []) as string[]).map((systemEmail) => ({
            [systemEmail]: email.id
          }))
        );
        OptionsService.setJSON("email-templates", newEmailTemplates);
        req.flash("success", "transactional-email-updated");
        res.redirect(req.originalUrl);
        break;
      }
      case "delete":
        await getRepository(EmailMailing).delete({ emailId: email.id });
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
    const mailing = await getRepository(EmailMailing).findOneBy({
      id: req.params.mailingId
    });
    if (!mailing) return next("route");

    const matches = email.body.match(/\*\|[^|]+\|\*/g) || [];
    const mergeFields = _.uniq(
      matches.map((f) => f.substring(2, f.length - 2))
    );
    res.render("mailing", {
      email,
      emailBody: formatEmailBody(email.body),
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
    const mailing = await getRepository(EmailMailing).findOneBy({
      id: req.params.mailingId
    });
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

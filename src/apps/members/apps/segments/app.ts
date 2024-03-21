import express from "express";

import { getRepository } from "#core/database";
import { hasNewModel } from "#core/middleware";
import { userToAuth, wrapAsync } from "#core/utils";

import SegmentService from "#core/services/SegmentService";

import Email from "#models/Email";
import EmailMailing from "#models/EmailMailing";
import Segment from "#models/Segment";
import SegmentOngoingEmail from "#models/SegmentOngoingEmail";
import SegmentContact from "#models/SegmentContact";

import { EmailSchema, schemaToEmail } from "#apps/tools/apps/emails/app";
import { cleanRuleGroup } from "#apps/members/app";
import ContactTransformer from "#api/transformers/ContactTransformer";

const app = express();

app.set("views", __dirname + "/views");

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const segments = await SegmentService.getSegmentsWithCount(
      userToAuth(req.user!)
    );
    res.render("index", { segments });
  })
);

app.get(
  "/:id",
  hasNewModel(Segment, "id"),
  wrapAsync(async (req, res) => {
    const segment = req.model as Segment;
    const ongoingEmails = await getRepository(SegmentOngoingEmail).find({
      where: { segmentId: segment.id },
      relations: { email: true }
    });
    res.render("segment", { segment, ongoingEmails });
  })
);

app.post(
  "/:id",
  hasNewModel(Segment, "id"),
  wrapAsync(async (req, res) => {
    const segment = req.model as Segment;

    switch (req.body.action) {
      case "update":
        await getRepository(Segment).update(segment.id, {
          name: req.body.name,
          description: req.body.description || "",
          order: req.body.order || 0,
          newsletterTag: req.body.newsletterTag
        });
        req.flash("success", "segment-updated");
        res.redirect(req.originalUrl);
        break;
      case "update-rules":
        await getRepository(Segment).update(segment.id, {
          ruleGroup: cleanRuleGroup(JSON.parse(req.body.rules))
        });
        req.flash("success", "segment-updated");
        res.redirect(req.originalUrl);
        break;
      case "toggle-ongoing-email":
        await getRepository(SegmentOngoingEmail).update(
          req.body.ongoingEmailId,
          { enabled: req.body.ongoingEmailEnabled === "true" }
        );
        res.redirect("/members/segments/" + segment.id + "#ongoingemails");
        break;
      case "delete-ongoing-email":
        await getRepository(SegmentOngoingEmail).delete(
          req.body.ongoingEmailId
        );
        res.redirect("/members/segments/" + segment.id + "#ongoingemails");
        break;
      case "delete":
        await getRepository(SegmentContact).delete({ segmentId: segment.id });
        await getRepository(SegmentOngoingEmail).delete({
          segmentId: segment.id
        });
        await getRepository(Segment).delete(segment.id);

        req.flash("success", "segment-deleted");
        res.redirect("/members/segments");
        break;
    }
  })
);

app.get(
  "/:id/email",
  hasNewModel(Segment, "id"),
  wrapAsync(async (req, res) => {
    const segment = req.model as Segment;
    segment.contactCount = await ContactTransformer.count(
      userToAuth(req.user!),
      { rules: segment.ruleGroup }
    );

    res.render("email", {
      segment,
      emails: await getRepository(Email).find()
    });
  })
);

interface CreateBaseEmail extends Omit<EmailSchema, "name"> {
  email: string;
}

interface CreateOneOffEmail extends CreateBaseEmail {
  type: "one-off";
}

interface CreateOngoingEmail extends CreateBaseEmail {
  type: "ongoing";
  trigger: "onJoin" | "onLeave";
  sendNow?: boolean;
}

type CreateEmail = CreateOneOffEmail | CreateOngoingEmail;

app.post(
  "/:id/email",
  hasNewModel(Segment, "id"),
  wrapAsync(async (req, res) => {
    const segment = req.model as Segment;
    const data = req.body as CreateEmail;

    const email =
      data.email === "__new__"
        ? await getRepository(Email).save(
            schemaToEmail({
              ...data,
              name: "Email to segment " + segment.name
            })
          )
        : await getRepository(Email).findOneByOrFail({ id: data.email });

    if (data.type === "ongoing") {
      await getRepository(SegmentOngoingEmail).save({
        segment,
        trigger: data.trigger,
        email,
        enabled: true
      });

      req.flash("success", "segment-created-ongoing-email");
    }

    if (data.type === "one-off" || data.sendNow) {
      const contacts = await SegmentService.getSegmentContacts(segment);
      const mailing = await getRepository(EmailMailing).save({
        email,
        emailField: "Email",
        nameField: "Name",
        mergeFields: {
          EMAIL: "Email",
          NAME: "Name",
          FNAME: "FirstName",
          LNAME: "LastName"
        },
        recipients: contacts.map((contact) => ({
          Email: contact.email,
          Name: contact.fullname,
          FirstName: contact.firstname,
          LastName: contact.lastname
        }))
      });

      req.flash("warning", "segment-preview-email");

      res.redirect(`/tools/emails/${email.id}/mailings/${mailing.id}?preview`);
    } else {
      res.redirect(`/members/segments/${segment.id}#ongoingemails`);
    }
  })
);

export default app;

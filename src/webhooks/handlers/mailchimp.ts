import { NewsletterStatus, ContributionType } from "@beabee/beabee-common";
import bodyParser from "body-parser";
import express from "express";

import { log as mainLogger } from "@core/logging";
import { cleanEmailAddress, wrapAsync } from "@core/utils";

import ContactsService from "@core/services/ContactsService";
import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";

import config from "@config";

const log = mainLogger.child({ app: "webhook-mailchimp" });

const app = express();

interface MCProfileData {
  email: string;
  merges: {
    [key: string]: string | undefined;
  };
}

interface MCUpdateEmailData {
  new_email: string;
  old_email: string;
}

interface MCCleanedEmailData {
  email: string;
}

interface MCProfileWebhook {
  type: "subscribe" | "unsubscribe" | "profile";
  data: MCProfileData;
}

interface MCUpdateEmailWebhook {
  type: "upemail";
  data: MCUpdateEmailData;
}

interface MCCleanedEmailWebhook {
  type: "cleaned";
  data: MCCleanedEmailData;
}

type MCWebhook =
  | MCProfileWebhook
  | MCUpdateEmailWebhook
  | MCCleanedEmailWebhook;

// Mailchimp pings this endpoint when you first add the webhook
// Don't check for newsletter provider here as the webhook can be set
// before Mailchimp has been enabled
app.get("/", (req, res) => {
  res.sendStatus(
    req.query.secret === config.newsletter.settings.webhookSecret ? 200 : 404
  );
});

app.use((req, res, next) => {
  if (
    config.newsletter.provider === "mailchimp" &&
    req.query["secret"] === config.newsletter.settings.webhookSecret
  ) {
    next();
  } else {
    res.sendStatus(404);
  }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post(
  "/",
  wrapAsync(async (req, res) => {
    const body = req.body as MCWebhook;

    log.info("Got webhook " + body.type);

    switch (body.type) {
      case "upemail":
        await handleUpdateEmail(body.data);
        break;

      case "subscribe":
        await handleSubscribe(body.data);
        break;

      case "unsubscribe":
        await handleUnsubscribe(body.data);
        break;

      case "cleaned":
        await handleCleaned(body.data);
        break;

      case "profile":
        // Make MailChimp resend the webhook if we don't find a contact
        // it's probably because the upemail and profile webhooks
        // arrived out of order
        // TODO: add checks for repeated failure
        if (!(await handleUpdateProfile(body.data))) {
          return res.sendStatus(404);
        }
        break;
    }

    res.sendStatus(200);
  })
);

async function handleUpdateEmail(data: MCUpdateEmailData) {
  const oldEmail = cleanEmailAddress(data.old_email);
  const newEmail = cleanEmailAddress(data.new_email);

  log.info(`Update email from ${oldEmail} to ${newEmail}`);

  const contact = await ContactsService.findOneBy({ email: oldEmail });
  if (contact) {
    await ContactsService.updateContact(
      contact,
      { email: newEmail },
      // Don't try to sync to old email address
      { sync: false }
    );
  } else {
    log.error("Old email not found in Mailchimp update email hook", data);
  }
}

async function handleSubscribe(data: MCProfileData) {
  const email = cleanEmailAddress(data.email);

  log.info({
    action: "subscribe",
    data: { email }
  });

  const contact = await ContactsService.findOneBy({ email });
  if (contact) {
    await ContactsService.updateContactProfile(contact, {
      newsletterStatus: NewsletterStatus.Subscribed
    });
    if (contact.membership?.isActive) {
      await NewsletterService.addTagToContacts(
        [contact],
        OptionsService.getText("newsletter-active-member-tag")
      );
    }
  } else {
    const nlContact = await NewsletterService.getNewsletterContact(email);
    await ContactsService.createContact(
      {
        email,
        firstname: data.merges.FNAME || "",
        lastname: data.merges.LNAME || ""
      },
      {
        newsletterStatus: NewsletterStatus.Subscribed,
        newsletterGroups: nlContact?.groups || []
      }
    );
  }
}

async function handleUnsubscribe(data: MCProfileData) {
  const email = cleanEmailAddress(data.email);

  log.info("Unsubscribe " + email);

  const contact = await ContactsService.findOneBy({ email });
  if (contact) {
    await ContactsService.updateContactProfile(contact, {
      newsletterStatus: NewsletterStatus.Unsubscribed
    });
  }
}

async function handleCleaned(data: MCCleanedEmailData) {
  const email = cleanEmailAddress(data.email);

  log.info("Cleaned " + email);

  const contact = await ContactsService.findOneBy({ email });
  if (contact) {
    await ContactsService.updateContactProfile(contact, {
      newsletterStatus: NewsletterStatus.Cleaned
    });
  }
}

async function handleUpdateProfile(data: MCProfileData): Promise<boolean> {
  const email = cleanEmailAddress(data.email);

  log.info("Update profile for " + email);

  const contact = await ContactsService.findOneBy({ email });
  if (contact) {
    const nlContact = await NewsletterService.getNewsletterContact(email);
    await ContactsService.updateContact(contact, {
      firstname: data.merges.FNAME || contact.firstname,
      lastname: data.merges.LNAME || contact.lastname
    });
    await ContactsService.updateContactProfile(contact, {
      newsletterGroups: nlContact?.groups || []
    });
    return true;
  } else {
    log.info("Contact not found for " + email);
    return false;
  }
}

export default app;

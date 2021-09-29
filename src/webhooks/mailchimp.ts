import bodyParser from "body-parser";
import express from "express";

import { log as mainLogger } from "@core/logging";
import { cleanEmailAddress, ContributionType, wrapAsync } from "@core/utils";

import MembersService from "@core/services/MembersService";
import NewsletterService from "@core/services/NewsletterService";

import { NewsletterStatus } from "@core/providers/newsletter";

import config from "@config";

const log = mainLogger.child({ app: "webhook-mailchimp" });

const app = express();

interface MCProfileData {
  email: string;
  merges: {
    FNAME: string;
    LNAME: string;
    [key: string]: string;
  };
}

interface MCUpdateEmailData {
  new_email: string;
  old_email: string;
}

interface MCProfileWebhook {
  type: "subscribe" | "unsubscribe" | "profile";
  data: MCProfileData;
}

interface MCUpdateEmailWebhook {
  type: "upemail";
  data: MCUpdateEmailData;
}

type MCWebhook = MCProfileWebhook | MCUpdateEmailWebhook;

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

      case "profile":
        // Make MailChimp resend the webhook if we don't find a member
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

  const member = await MembersService.findOne({ email: oldEmail });
  if (member) {
    await MembersService.updateMember(member, { email: newEmail });
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

  const member = await MembersService.findOne({ email });
  if (member) {
    await MembersService.updateMemberProfile(member, {
      newsletterStatus: NewsletterStatus.Subscribed
    });
  } else {
    const nlMember = await NewsletterService.getNewsletterMember(email);
    await MembersService.createMember(
      {
        email,
        firstname: data.merges.FNAME,
        lastname: data.merges.LNAME,
        contributionType: ContributionType.None
      },
      {
        newsletterStatus: NewsletterStatus.Subscribed,
        newsletterGroups: nlMember?.groups
      }
    );
  }
}

async function handleUnsubscribe(data: MCProfileData) {
  const email = cleanEmailAddress(data.email);

  log.info("Unsubscribe " + email);

  const member = await MembersService.findOne({ email });
  if (member) {
    await MembersService.updateMemberProfile(member, {
      newsletterStatus: NewsletterStatus.Unsubscribed
    });
  }
}

async function handleUpdateProfile(data: MCProfileData): Promise<boolean> {
  const email = cleanEmailAddress(data.email);

  log.info("Update profile for " + email);

  const member = await MembersService.findOne({ email });
  if (member) {
    const nlMember = await NewsletterService.getNewsletterMember(email);
    await MembersService.updateMember(member, {
      firstname: data.merges.FNAME,
      lastname: data.merges.LNAME
    });
    await MembersService.updateMemberProfile(member, {
      newsletterGroups: nlMember?.groups
    });
    return true;
  } else {
    log.info("Member not found for " + email);
    return false;
  }
}

export default app;

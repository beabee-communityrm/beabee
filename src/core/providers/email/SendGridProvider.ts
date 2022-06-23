import sgMail from "@sendgrid/mail";

import { log as mainLogger } from "@core/logging";
import { formatEmailBody } from "@core/utils/email";

import Email from "@models/Email";

import { EmailOptions, EmailRecipient } from ".";
import LocalProvider from "./LocalProvider";

import { SendGridEmailConfig } from "@config";

const log = mainLogger.child({ app: "sendgrid-email-provider" });

export default class SendGridProvider extends LocalProvider {
  private readonly testMode: boolean;

  constructor(settings: SendGridEmailConfig["settings"]) {
    super();
    sgMail.setApiKey(settings.apiKey);
    sgMail.setSubstitutionWrappers("*|", "|*");
    this.testMode = settings.testMode;
  }

  async sendEmail(
    email: Email,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    const resp = await sgMail.sendMultiple({
      from: {
        email: email.fromEmail,
        name: email.fromName
      },
      subject: email.subject,
      html: formatEmailBody(email.body),
      personalizations: recipients.map((recipient) => ({
        to: recipient.to,
        ...(recipient.mergeFields && { substitutions: recipient.mergeFields })
      })),
      ...(opts?.sendAt && {
        sendAt: +opts.sendAt
      }),
      ...(opts?.attachments && {
        attachments: opts.attachments.map((attachment) => ({
          filename: attachment.name,
          type: attachment.type,
          content: attachment.content
        }))
      }),
      mailSettings: {
        sandboxMode: {
          enable: this.testMode
        }
      }
    });

    log.info("Sent email", { resp });
  }
}

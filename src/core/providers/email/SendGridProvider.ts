import sgMail from "@sendgrid/mail";
import { getRepository } from "typeorm";

import { log as mainLogger } from "@core/logging";

import Email from "@models/Email";

import { EmailOptions, EmailProvider, EmailRecipient, EmailTemplate } from ".";

import { SendGridEmailConfig } from "@config";

const log = mainLogger.child({ app: "sendgrid-email-provider" });

export default class SendGridProvider implements EmailProvider {
  private readonly testMode: boolean;

  constructor(settings: SendGridEmailConfig["settings"]) {
    sgMail.setApiKey(settings.apiKey);
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
      html: email.body.replace(/\r\n/g, "<br>"),
      personalizations: recipients.map((recipient) => ({
        to: recipient.to,
        substitutions: recipient.mergeFields
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
  async sendTemplate(
    template: string,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    log.info("Sending template " + template);
    const email = await getRepository(Email).findOne(template);
    if (email) {
      await this.sendEmail(email, recipients, opts);
    }
  }
  async getTemplates(): Promise<EmailTemplate[]> {
    const emails = await getRepository(Email).find();
    return emails.map((email) => ({ id: email.id, name: email.name }));
  }
}

import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { getRepository } from "typeorm";

import { log as mainLogger } from "@core/logging";

import Email from "@models/Email";

import { EmailOptions, EmailProvider, EmailRecipient, EmailTemplate } from ".";
import { SMTPEmailConfig } from "@config";

const log = mainLogger.child({ app: "smtp-email-provider" });

export default class SMTPProvider implements EmailProvider {
  private readonly client: Mail;

  constructor(settings: SMTPEmailConfig["settings"]) {
    this.client = nodemailer.createTransport(settings);
  }

  async sendEmail(
    email: Email,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    if (opts?.sendAt) {
      log.error("SMTPEmailProvider doesn't support sendAt, ignoring email");
      return;
    }

    log.info("Sending email " + email.id);

    for (const recipient of recipients) {
      const mergedBody = Object.keys(recipient.mergeFields || {}).reduce(
        (body, field) => {
          return body.replace(
            new RegExp(`\\*\\|${field}\\|\\*`, "g"),
            "" + recipient.mergeFields![field]
          );
        },
        email.bodyInline
      );

      await this.client.sendMail({
        from: { name: email.fromName, address: email.fromEmail },
        to: recipient.to.name
          ? { name: recipient.to.name, address: recipient.to.email }
          : recipient.to.email,
        subject: email.subject,
        html: mergedBody,
        ...(opts?.attachments && {
          attachments: opts.attachments.map((a) => ({
            filename: a.name,
            contentType: a.type,
            content: a.content
          }))
        })
      });
    }
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

  async getTemplate(template: string): Promise<EmailTemplate | undefined> {
    const email = await getRepository(Email).findOne(template);
    return (
      email && {
        id: email.id,
        name: email.name
      }
    );
  }
}

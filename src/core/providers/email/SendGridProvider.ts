import { getRepository } from "typeorm";

import { log as mainLogger } from "@core/logging";

import Email from "@models/Email";

import { EmailOptions, EmailProvider, EmailRecipient, EmailTemplate } from ".";

const log = mainLogger.child({ app: "sendgrid-email-provider" });

export default class SendGridProvider implements EmailProvider {
  sendEmail(
    email: Email,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    throw new Error("Method not implemented.");
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

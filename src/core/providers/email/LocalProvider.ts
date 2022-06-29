import { getRepository } from "typeorm";

import Email from "@models/Email";

import { EmailProvider, EmailRecipient, EmailOptions, EmailTemplate } from ".";

export default abstract class LocalProvider implements EmailProvider {
  abstract sendEmail(
    email: Email,
    recipients: EmailRecipient[],
    opts?: EmailOptions | undefined
  ): Promise<void>;

  async sendTemplate(
    template: string,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    const email = await getRepository(Email).findOne(template);
    if (email) {
      await this.sendEmail(email, recipients, opts);
    }
  }

  async getTemplateEmail(template: string): Promise<false | Email | null> {
    return (await getRepository(Email).findOne(template)) || null;
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    const emails = await getRepository(Email).find();
    return emails.map((email) => ({ id: email.id, name: email.name }));
  }
}

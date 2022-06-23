import Email from "@models/Email";

export interface EmailTemplate {
  id: string;
  name: string;
}

export type EmailMergeFields = Record<string, string>;

export interface EmailPerson {
  email: string;
  name?: string;
}

export interface EmailRecipient {
  to: EmailPerson;
  mergeFields?: EmailMergeFields;
}

export interface EmailAttachment {
  type: string;
  name: string;
  content: string;
}

export interface EmailOptions {
  attachments?: EmailAttachment[];
  sendAt?: Date | undefined;
}

export interface EmailProvider {
  sendEmail(
    email: Email,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void>;
  sendTemplate(
    template: string,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void>;
  getTemplateEmail(template: string): Promise<false | Email | null>;
  getTemplates(): Promise<EmailTemplate[]>;
}

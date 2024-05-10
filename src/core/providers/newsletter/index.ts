import { NewsletterStatus } from "@beabee/beabee-common";

export interface UpdateNewsletterContact {
  email: string;
  status: NewsletterStatus;
  firstname?: string;
  lastname?: string;
  groups?: string[];
  fields?: Record<string, string>;
}

export interface NewsletterContact extends UpdateNewsletterContact {
  firstname: string;
  lastname: string;
  joined: Date;
  status: NewsletterStatus;
  groups: string[];
  tags: string[];
  fields: Record<string, string>;
}

export interface NewsletterProvider {
  addTagToContacts(emails: string[], tag: string): Promise<void>;
  removeTagFromContacts(emails: string[], tag: string): Promise<void>;
  getContact(email: string): Promise<NewsletterContact | undefined>;
  getContacts(): Promise<NewsletterContact[]>;
  updateContact(
    contact: UpdateNewsletterContact,
    oldEmail?: string
  ): Promise<void>;
  upsertContacts(contacts: UpdateNewsletterContact[]): Promise<void>;
  archiveContacts(emails: string[]): Promise<void>;
  permanentlyDeleteContacts(emails: string[]): Promise<void>;
}

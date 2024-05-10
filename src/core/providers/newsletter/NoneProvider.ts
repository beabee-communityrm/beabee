import {
  NewsletterContact,
  NewsletterProvider,
  UpdateNewsletterContact
} from ".";

export default class NoneProvider implements NewsletterProvider {
  async addTagToContacts(emails: string[], tag: string): Promise<void> {}
  async removeTagFromContacts(emails: string[], tag: string): Promise<void> {}
  async getContact(email: string): Promise<NewsletterContact | undefined> {
    return;
  }
  async getContacts(): Promise<NewsletterContact[]> {
    return [];
  }
  async updateContact(
    contact: UpdateNewsletterContact,
    oldEmail?: string
  ): Promise<void> {}
  async upsertContacts(contacts: UpdateNewsletterContact[]): Promise<void> {}
  async archiveContacts(emails: string[]): Promise<void> {}
  async permanentlyDeleteContacts(emails: string[]): Promise<void> {}
}

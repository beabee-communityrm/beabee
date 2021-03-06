import {
  NewsletterMember,
  NewsletterProvider,
  UpdateNewsletterMember
} from ".";

export default class NoneProvider implements NewsletterProvider {
  async addTagToMembers(emails: string[], tag: string): Promise<void> {}
  async removeTagFromMembers(emails: string[], tag: string): Promise<void> {}
  async getMember(email: string): Promise<NewsletterMember | undefined> {
    return;
  }
  async getMembers(): Promise<NewsletterMember[]> {
    return [];
  }
  async updateMember(
    member: UpdateNewsletterMember,
    oldEmail?: string
  ): Promise<void> {}
  async upsertMembers(members: UpdateNewsletterMember[]): Promise<void> {}
  async archiveMembers(emails: string[]): Promise<void> {}
  async deleteMembers(emails: string[]): Promise<void> {}
}

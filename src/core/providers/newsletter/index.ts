export enum NewsletterStatus {
  Subscribed = "subscribed",
  Unsubscribed = "unsubscribed",
  Pending = "pending",
  Cleaned = "cleaned"
}

export interface NewsletterMember {
  email: string;
  firstname: string;
  lastname: string;
  joined: Date;
  status: NewsletterStatus;
  groups: string[];
  tags: string[];
  fields: Record<string, string>;
}

// Email is always required
// Tags can't be pushed via update/upsert
// Joined can't be changed
export type PartialNewsletterMember = Partial<
  Omit<NewsletterMember, "tags" | "email" | "joined">
> & { email: string };

export interface NewsletterProvider {
  addTagToMembers(emails: string[], tag: string): Promise<void>;
  removeTagFromMembers(emails: string[], tag: string): Promise<void>;
  getMember(email: string): Promise<NewsletterMember | undefined>;
  getMembers(): Promise<NewsletterMember[]>;
  updateMember(
    member: PartialNewsletterMember,
    oldEmail?: string
  ): Promise<void>;
  upsertMembers(members: PartialNewsletterMember[]): Promise<void>;
  archiveMembers(emails: string[]): Promise<void>;
  deleteMembers(emails: string[]): Promise<void>;
}

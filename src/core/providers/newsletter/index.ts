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
  status: NewsletterStatus;
  groups: string[];
  tags: string[];
  fields: Record<string, string>;
}

// Email is always required, tags can't be pushed via update/upsert at the moment
export type PartialNewsletterMember = Partial<
  Omit<NewsletterMember, "tags" | "email">
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

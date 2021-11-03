export enum NewsletterStatus {
  Subscribed = "subscribed",
  Unsubscribed = "unsubscribed",
  Pending = "pending",
  Cleaned = "cleaned"
}

export interface UpdateNewsletterMember {
  email: string;
  status: NewsletterStatus;
  firstname?: string;
  lastname?: string;
  groups?: string[];
  fields?: Record<string, string>;
}

export interface NewsletterMember extends UpdateNewsletterMember {
  firstname: string;
  lastname: string;
  joined: Date;
  status: NewsletterStatus;
  groups: string[];
  tags: string[];
  fields: Record<string, string>;
}

export interface NewsletterProvider {
  addTagToMembers(emails: string[], tag: string): Promise<void>;
  removeTagFromMembers(emails: string[], tag: string): Promise<void>;
  getMember(email: string): Promise<NewsletterMember | undefined>;
  getMembers(): Promise<NewsletterMember[]>;
  updateMember(
    member: UpdateNewsletterMember,
    oldEmail?: string
  ): Promise<void>;
  upsertMembers(members: UpdateNewsletterMember[]): Promise<void>;
  archiveMembers(emails: string[]): Promise<void>;
  deleteMembers(emails: string[]): Promise<void>;
}
